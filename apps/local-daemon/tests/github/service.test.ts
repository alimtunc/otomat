import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import {
  getIssue,
  getPullRequestForRun,
  getRun,
  insertPullRequest,
  schema,
  updatePullRequest,
  writePullRequestGenerator,
} from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, GitHubCliError, type GitHubServiceConfig } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver, type TestRepo } from "../support/git.js";
import {
  CONNECTED_GITHUB as connected,
  DISCONNECTED_GITHUB,
  FakeGitHubCli,
  publishRequest,
} from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-github";
const BRANCH = `otomat/run/${RUN_ID}`;

/** The fake provider reports an open PR, so `ready` is the mode that leaves it untouched. */
const READY_REQUEST = publishRequest("ship it");
const DRAFT_REQUEST = publishRequest("ship it", { mode: "draft" });

describe("GitHubService", () => {
  let fix: DaemonTestDb;
  let repo: TestRepo;
  let worktrees: GitWorktreeService;
  let worktreePath: string;
  let cli: FakeGitHubCli;

  beforeEach(() => {
    fix = setupDaemonDb();
    repo = fix.repo;
    worktrees = createGitWorktreeService({
      db: fix.db,
      repositoryId: "repo-1",
      repoRoot: repo.root,
      defaultBranch: repo.defaultBranch,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    });
    const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
    worktreePath = acquired.path;
    seedRun(fix.db, {
      runId: RUN_ID,
      worktreeId: acquired.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    writeFileSync(join(worktreePath, "change.txt"), "first\n");
    cli = new FakeGitHubCli();
    cli.provider = { ...cli.provider, headRef: BRANCH };
  });

  afterEach(() => {
    fix.cleanup();
  });

  function run() {
    const row = getRun(fix.db, RUN_ID);
    if (!row) throw new Error("seeded run missing");
    return row;
  }

  function service(
    worktreeService: GitWorktreeService = worktrees,
    generator?: GitHubServiceConfig["generator"],
  ) {
    const config: GitHubServiceConfig = {
      db: fix.db,
      dataDir: fix.dataDir,
      repositories: stubRepositoryResolver(worktreeService, {
        repositoryId: fix.repositoryId,
        rootPath: fix.repo.root,
        worktreesRoot: join(fix.dataDir, "worktrees"),
      }),
      cli,
      idFactory: () => "pr-local-1",
    };
    if (generator) config.generator = generator;
    return createGitHubService(config);
  }

  /** Puts a runtime on PATH so agent resolution stops gating what this suite is really asserting. */
  function withStubbedClaude(assertion: () => Promise<void>): Promise<void> {
    const binDir = join(fix.dataDir, "runtime-bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writePullRequestGenerator(fix.db, { runtime: "claude", model: null, options: {} });
    const restore = process.env.PATH;
    process.env.PATH = `${binDir}${delimiter}${restore ?? ""}`;
    return assertion().finally(() => {
      process.env.PATH = restore;
    });
  }

  it("publishes a review comment on the anchor sha review supplies", async () => {
    insertPullRequest(fix.db, {
      id: "pr-comment",
      issue_id: "i1",
      run_id: RUN_ID,
      number: 7,
      url: "https://github.com/acme/app/pull/7",
      status: "open",
      publication_status: "created",
      title: "Ship it",
      head_ref: BRANCH,
      published_head_sha: "a".repeat(40),
    });

    await expect(
      service().publishReviewComment("pr-comment", {
        commitSha: "a".repeat(40),
        filePath: "change.txt",
        side: "new",
        startLine: 1,
        line: 2,
        body: "rename these",
        suggestion: "second",
      }),
    ).resolves.toEqual({ url: "https://github.com/acme/app/pull/7#discussion_r1" });

    expect(cli.reviewComments[0]).toMatchObject({
      commitSha: "a".repeat(40),
      path: "change.txt",
      side: "RIGHT",
      line: 2,
      startLine: 1,
      startSide: "RIGHT",
      body: "rename these\n\n```suggestion\nsecond\n```",
    });
  });

  it("refuses to publish a review comment with no pull request to anchor it on", async () => {
    await expect(
      service().publishReviewComment("pr-comment", {
        commitSha: "a".repeat(40),
        filePath: "change.txt",
        side: "new",
        startLine: null,
        line: 2,
        body: "nowhere to go",
        suggestion: null,
      }),
    ).rejects.toThrow(/no pull request/);
  });

  it("returns a safe failed connection state when GitHub auth metadata is invalid", async () => {
    cli.connectionError = new GitHubCliError(
      "github_auth_response_invalid",
      "GitHub auth response was invalid.",
    );

    await expect(service().connection()).resolves.toEqual({
      status: "failed",
      login: null,
      device_authorization: null,
      error_code: "github_auth_response_invalid",
      error_message: "GitHub auth response was invalid.",
    });
  });

  it("returns a connection-specific safe failure for an unexpected connection error", async () => {
    cli.connectionError = new Error("sensitive failure");

    await expect(service().connection()).resolves.toEqual({
      status: "failed",
      login: null,
      device_authorization: null,
      error_code: "github_connection_failed",
      error_message: "GitHub connection failed unexpectedly.",
    });
  });

  it("persists not_configured without touching git when authentication is missing", async () => {
    cli.connectionValue = DISCONNECTED_GITHUB;

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "not_configured",
      number: null,
      url: null,
      error_code: "github_auth_required",
    });
    expect(cli.pushCalls).toBe(0);
    expect(cli.createCalls).toBe(0);
  });

  it("persists a failed publication when the connection preflight fails", async () => {
    cli.connectionValue = {
      status: "failed",
      login: null,
      device_authorization: null,
      error_code: "github_auth_status_failed",
      error_message: "GitHub authentication status could not be read.",
    };

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_auth_status_failed",
      error_message: "GitHub authentication status could not be read.",
    });
    expect(cli.pushCalls).toBe(0);
    expect(cli.createCalls).toBe(0);
  });

  it("restores a created publication after reconnecting without new changes", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.connectionValue = DISCONNECTED_GITHUB;
    const disconnected = await github.publish(run(), READY_REQUEST);
    expect(disconnected.row.publication_status).toBe("not_configured");

    cli.connectionValue = connected;
    const recovered = await github.publish(run(), READY_REQUEST);

    expect(recovered.row).toMatchObject({
      publication_status: "created",
      error_code: null,
      error_message: null,
    });
    expect(cli.pushCalls).toBe(1);
    expect(cli.updateCalls).toBe(0);
  });

  it("adopts a migrated provider row as created without pushing anything", async () => {
    insertPullRequest(fix.db, {
      id: "pr-legacy",
      issue_id: "i1",
      run_id: RUN_ID,
      provider: "github",
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "not_configured",
      title: "Ship it",
      body: "Details",
      head_ref: BRANCH,
      base_ref: "main",
    });
    cli.providerExists = true;

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      id: "pr-legacy",
      publication_status: "created",
      number: 42,
      published_head_sha: null,
      published_diff_sha: null,
    });
    expect(cli.pushCalls).toBe(0);
    expect(cli.createCalls).toBe(0);
  });

  it("refuses publication when the canonical git diff is empty", async () => {
    writeFileSync(join(worktreePath, "change.txt"), "");
    repo.git("-C", worktreePath, "clean", "-fd");

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "diff_empty",
      number: null,
      url: null,
    });
    expect(cli.pushCalls).toBe(0);
  });

  it("persists a safe failure when the canonical git diff cannot be read", async () => {
    const brokenWorktrees: GitWorktreeService = {
      ...worktrees,
      diff() {
        throw new Error("sensitive git output");
      },
    };

    const result = await service(brokenWorktrees).publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_publication_failed",
      error_message: "GitHub publication failed unexpectedly.",
    });
  });

  it("persists a safe failure when the auth command returns invalid data", async () => {
    cli.connectionError = new GitHubCliError(
      "github_auth_response_invalid",
      "GitHub auth response was invalid.",
    );

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_auth_response_invalid",
      error_message: "GitHub auth response was invalid.",
    });
  });

  it("persists a safe failure when no GitHub remote exists", async () => {
    cli.resolveError = new GitHubCliError(
      "github_remote_missing",
      "No usable GitHub remote was found for this run.",
    );

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_remote_missing",
      number: null,
      url: null,
    });
    expect(cli.pushCalls).toBe(0);
  });

  it("refuses a generation before paying for it when the remote cannot be resolved", async () => {
    cli.resolveError = new GitHubCliError(
      "github_remote_missing",
      "No usable GitHub remote was found for this run in /w: origin (https://***@gitlab.com/acme/otomat.git is not a GitHub repository URL).",
    );
    let generated = 0;

    await withStubbedClaude(async () => {
      const generating = service(worktrees, {
        generate: async () => {
          generated += 1;
          throw new Error("the generator must not run behind an unresolvable remote");
        },
      });

      await expect(generating.generatePullRequestMetadata(run())).rejects.toMatchObject({
        code: "github_remote_missing",
      });
    });

    expect(generated).toBe(0);
    expect(getPullRequestForRun(fix.db, RUN_ID)).toBeUndefined();
  });

  it("publishes on retry once the remote is fixed, on the same run", async () => {
    cli.resolveError = new GitHubCliError(
      "github_remote_missing",
      "No usable GitHub remote was found for this run.",
    );
    const failed = await service().publish(run(), READY_REQUEST);
    expect(failed.row).toMatchObject({ publication_status: "failed", number: null });

    cli.resolveError = null;
    const retried = await service().publish(run(), READY_REQUEST);

    expect(retried.row).toMatchObject({
      id: failed.row.id,
      run_id: RUN_ID,
      publication_status: "created",
      number: 42,
      error_code: null,
      error_message: null,
    });
    expect(cli.pushCalls).toBe(1);
  });

  it("keeps confirmed metadata null when push fails", async () => {
    cli.pushError = new GitHubCliError(
      "github_push_failed",
      "The run branch could not be pushed to GitHub.",
    );

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_push_failed",
      number: null,
      url: null,
    });
    expect(cli.createCalls).toBe(0);
  });

  it("keeps confirmed metadata null when create fails", async () => {
    cli.createError = new GitHubCliError(
      "github_pr_create_failed",
      "GitHub could not create the pull request.",
    );

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_pr_create_failed",
      number: null,
      url: null,
    });
  });

  it("ships a first publish under the requested head branch", async () => {
    cli.provider = { ...cli.provider, headRef: "feat/add-note" };

    const result = await service().publish(run(), {
      ...READY_REQUEST,
      head_ref: "feat/add-note",
    });

    expect(result.row.publication_status).toBe("created");
    expect(cli.pushedBranches).toEqual(["feat/add-note"]);
    expect(cli.createInput?.head).toBe("feat/add-note");
    expect(result.row.head_ref).toBe("feat/add-note");
  });

  it("keeps the chosen head branch across a failed create so a retry targets it", async () => {
    cli.createError = new GitHubCliError(
      "github_pr_create_failed",
      "GitHub could not create the pull request.",
    );
    const github = service();

    const failed = await github.publish(run(), {
      ...READY_REQUEST,
      head_ref: "feat/add-note",
    });
    expect(failed.row.publication_status).toBe("failed");
    expect(failed.row.head_ref).toBe("feat/add-note");

    cli.createError = null;
    cli.provider = { ...cli.provider, headRef: "feat/add-note" };
    const retried = await github.publish(run(), READY_REQUEST);

    expect(retried.row.publication_status).toBe("created");
    expect(cli.pushedBranches).toEqual(["feat/add-note", "feat/add-note"]);
    expect(cli.createInput?.head).toBe("feat/add-note");
  });

  it("targets the run's frozen fork branch, never the repository default", async () => {
    repo.git("branch", "feature-base");
    const forked = worktrees.acquire({
      owner: "run-forked",
      branch: "otomat/run/run-forked",
      baseRef: "feature-base",
    });
    seedRun(fix.db, {
      runId: "run-forked",
      worktreeId: forked.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    writeFileSync(join(forked.path, "change.txt"), "forked\n");
    cli.provider = { ...cli.provider, headRef: "otomat/run/run-forked", baseRef: "feature-base" };

    const forkedRun = getRun(fix.db, "run-forked");
    if (!forkedRun) throw new Error("seeded run missing");
    const result = await service().publish(forkedRun, READY_REQUEST);

    expect(result.row.publication_status).toBe("created");
    expect(cli.createInput?.base).toBe("feature-base");
  });

  it("names a missing base branch instead of relaying GitHub's raw create failure", async () => {
    cli.createError = new GitHubCliError(
      "github_pr_create_failed",
      "GitHub could not create the pull request. (GraphQL: Base ref must be a branch)",
    );
    cli.baseExists = false;

    const result = await service().publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_base_branch_missing",
      number: null,
      url: null,
    });
    expect(result.row.error_message).toContain("does not exist on GitHub");
  });

  it("snapshots, pushes, creates, persists and emits only confirmed metadata", async () => {
    const github = service();
    const result = await github.publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      provider: "github",
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
      title: "feat: ship it",
      body: "Details",
      head_ref: BRANCH,
      base_ref: "main",
      error_code: null,
      error_message: null,
    });
    expect(result.row.published_head_sha).toBe(worktrees.get(RUN_ID)?.headSha);
    expect(result.row.published_diff_sha).toBe(worktrees.diff(RUN_ID).sha);
    expect(result.sync).toMatchObject({ state: "in_sync", dirty: false });
    expect(repo.git("-C", worktreePath, "status", "--porcelain").trim()).toBe("");
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);

    const events = readRunEvents(fix.db, RUN_ID);
    expect(events.map((event) => event.type)).toEqual([
      "pr.updated",
      "pr.updated",
      "pr.updated",
      "pr.created",
    ]);
    expect(events.map((event) => event.payload["publication_status"])).toEqual([
      "pushing",
      "creating",
      "creating",
      "created",
    ]);
    expect(events.at(-1)?.source).toBe("github");
  });

  it("opens the pull request against the branch the run forked from, not the repository default", async () => {
    repo.git("branch", "release/v1");
    const acquired = worktrees.acquire({
      owner: "r-release",
      branch: "otomat/run/r-release",
      baseRef: "release/v1",
    });
    seedRun(fix.db, {
      runId: "r-release",
      worktreeId: acquired.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    writeFileSync(join(acquired.path, "change.txt"), "release work\n");
    const released = getRun(fix.db, "r-release");
    if (!released) throw new Error("seeded release run missing");

    const result = await service().publish(released, READY_REQUEST);

    // The reviewed diff is computed against `release/v1`; a PR based on `main` would
    // show every commit `release/v1` carries that the reviewer never saw.
    expect(cli.createInput?.base).toBe("release/v1");
    expect(result.row.base_ref).toBe("release/v1");
  });

  it("falls back to the repository default for a worktree recorded before fork refs", async () => {
    const acquired = worktrees.acquire({ owner: "r-legacy", branch: "otomat/run/r-legacy" });
    fix.db
      .update(schema.worktrees)
      .set({ base_ref: "" })
      .where(eq(schema.worktrees.id, acquired.id))
      .run();
    seedRun(fix.db, {
      runId: "r-legacy",
      worktreeId: acquired.id,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    writeFileSync(join(acquired.path, "change.txt"), "legacy work\n");
    const legacy = getRun(fix.db, "r-legacy");
    if (!legacy) throw new Error("seeded legacy run missing");

    await service().publish(legacy, READY_REQUEST);

    expect(cli.createInput?.base).toBe(repo.defaultBranch);
  });

  it("reports an unavailable comparison instead of a false up-to-date state", async () => {
    await service().publish(run(), READY_REQUEST);
    cli.remoteHead = async () => {
      throw new GitHubCliError("github_remote_head_failed", "gh is offline.");
    };

    const viewed = await service().getPullRequest(RUN_ID);

    expect(viewed?.sync).toMatchObject({ state: "unavailable", ahead: [], replaced: [] });
  });

  it("adopts an existing provider PR and never creates a duplicate", async () => {
    cli.providerExists = true;
    cli.provider = { ...cli.provider, title: "feat: ship it", body: "Existing provider body" };
    const github = service();

    const first = await github.publish(run(), READY_REQUEST);
    const second = await github.publish(run(), {
      ...READY_REQUEST,
      body: "Existing provider body",
    });

    expect(first.row.id).toBe(second.row.id);
    expect(first.row).toMatchObject({ title: "feat: ship it", body: "Existing provider body" });
    expect(cli.createCalls).toBe(0);
    expect(cli.pushCalls).toBe(1);
    expect(getPullRequestForRun(fix.db, RUN_ID)?.number).toBe(42);
  });

  it("treats an empty provider body as the canonical empty body", async () => {
    cli.provider = { ...cli.provider, body: "" };
    const github = service();

    const first = await github.publish(run(), publishRequest("ship it", { body: "" }));
    const second = await github.publish(run(), publishRequest("ship it", { body: "" }));

    expect(first.row.body).toBeNull();
    expect(second.row.body).toBeNull();
    expect(cli.pushCalls).toBe(1);
    expect(cli.updateCalls).toBe(0);
  });

  it("coalesces concurrent publication requests for one run", async () => {
    const github = service();

    const [first, second] = await Promise.all([
      github.publish(run(), READY_REQUEST),
      github.publish(run(), publishRequest("ignore this one", { body: "Ignored" })),
    ]);

    expect(first.row.id).toBe(second.row.id);
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
  });

  it.each(["pushing", "creating"] as const)(
    "recovers an interrupted %s publication after daemon restart",
    async (publicationStatus) => {
      cli.connectionValue = DISCONNECTED_GITHUB;
      await service().publish(run(), READY_REQUEST);
      const row = getPullRequestForRun(fix.db, RUN_ID);
      if (!row) throw new Error("local pull request missing");
      updatePullRequest(fix.db, row.id, { publication_status: publicationStatus });

      cli.connectionValue = connected;
      cli.providerExists = publicationStatus === "creating";
      const restarted = service();
      expect((await restarted.getPullRequest(RUN_ID))?.row).toMatchObject({
        publication_status: "failed",
        error_code: "github_publication_interrupted",
      });

      const recovered = await restarted.publish(run(), READY_REQUEST);

      expect(recovered.row).toMatchObject({
        publication_status: "created",
        number: 42,
        url: "https://github.com/acme/otomat/pull/42",
      });
      expect(cli.createCalls).toBe(publicationStatus === "creating" ? 0 : 1);
    },
  );

  it("updates the details of an open PR without publishing the workspace's later work", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    writeFileSync(join(worktreePath, "change.txt"), "first\nsecond\n");

    expect((await github.getPullRequest(RUN_ID))?.sync).toMatchObject({
      state: "in_sync",
      dirty: true,
    });
    const updated = await github.publish(
      run(),
      publishRequest("ship it better", { body: "New body" }),
    );

    expect(updated.row).toMatchObject({
      id: "pr-local-1",
      number: 42,
      publication_status: "created",
      title: "feat: ship it better",
      body: "New body",
    });
    expect(updated.sync).toMatchObject({ dirty: true });
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(1);
  });

  it("updates a known pull request by number after its base branch changes", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.provider = { ...cli.provider, baseRef: "release" };
    writeFileSync(join(worktreePath, "change.txt"), "first\nsecond\n");

    const updated = await github.publish(
      run(),
      publishRequest("ship it better", { body: "New body" }),
    );

    expect(updated.row).toMatchObject({
      publication_status: "created",
      number: 42,
      base_ref: "release",
      title: "feat: ship it better",
    });
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(1);
  });

  it("refreshes provider lifecycle without pushing an unchanged branch", async () => {
    cli.provider = { ...cli.provider, lifecycle: "draft" };
    const github = service();
    const created = await github.publish(run(), DRAFT_REQUEST);
    expect(created.row.status).toBe("draft");

    cli.provider = { ...cli.provider, lifecycle: "open" };
    const refreshed = await github.publish(run(), READY_REQUEST);

    expect(refreshed.row.status).toBe("open");
    expect(cli.pushCalls).toBe(1);
  });

  it("refreshes merged lifecycle and refuses to publish another PR for the run", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.provider = { ...cli.provider, lifecycle: "merged" };
    writeFileSync(join(worktreePath, "after-merge.txt"), "follow up\n");

    const result = await github.publish(run(), publishRequest("open another one", { body: "No" }));

    expect(result.row).toMatchObject({ status: "merged", number: 42 });
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(0);
  });

  it("resolves the remote from the run's own worktree, never an implicit local checkout", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);

    await github.getPullRequest(RUN_ID);

    expect(cli.resolveRemoteCwds).toContain(worktreePath);
    expect(cli.resolveRemoteCwds).not.toContain(repo.root);
  });

  it("notices a merge when the PR panel is read, and settles the run there", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.provider = { ...cli.provider, lifecycle: "merged" };

    const viewed = await github.getPullRequest(RUN_ID);

    expect(viewed?.row).toMatchObject({ status: "merged", number: 42 });
    expect(viewed?.sync).toBeNull();
    expect(existsSync(worktreePath)).toBe(false);
    expect(getIssue(fix.db, "i1")?.status).toBe("done");
  });

  it("leaves the stored pull request alone when GitHub cannot be reached", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.viewError = new GitHubCliError("github_pr_view_failed", "gh is offline.");

    const viewed = await github.getPullRequest(RUN_ID);

    expect(viewed?.row).toMatchObject({ status: "open", number: 42 });
    expect(existsSync(worktreePath)).toBe(true);
    expect(getIssue(fix.db, "i1")?.status).not.toBe("done");
  });

  it("keeps a closed pull request terminal when it is reopened on GitHub", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);
    cli.provider = { ...cli.provider, lifecycle: "closed" };
    writeFileSync(join(worktreePath, "after-close.txt"), "follow up\n");
    const closed = await github.publish(run(), publishRequest("open another one", { body: "No" }));
    expect(closed.row.status).toBe("closed");

    cli.provider = { ...cli.provider, lifecycle: "open" };
    const reopened = await github.publish(run(), publishRequest("reopen it", { body: "No" }));

    expect(reopened.row).toMatchObject({ status: "closed", number: 42 });
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(0);
  });

  it("creates the pull request as a draft when draft is the requested mode", async () => {
    const result = await service().publish(run(), DRAFT_REQUEST);

    expect(cli.createInput?.draft).toBe(true);
    expect(result.row).toMatchObject({ status: "draft", publication_status: "created" });
    expect(cli.modeInputs).toEqual([]);
  });

  it("creates the pull request ready for review when ready is the requested mode", async () => {
    const result = await service().publish(run(), READY_REQUEST);

    expect(cli.createInput?.draft).toBe(false);
    expect(result.row).toMatchObject({ status: "open", publication_status: "created" });
    expect(cli.modeInputs).toEqual([]);
  });

  it("marks an existing draft ready for review, and never merges it", async () => {
    const github = service();
    await github.publish(run(), DRAFT_REQUEST);

    const ready = await github.publish(run(), READY_REQUEST);

    expect(cli.modeInputs).toEqual([
      { cwd: worktreePath, repository: "acme/otomat", number: 42, draft: false },
    ]);
    expect(ready.row).toMatchObject({ status: "open", publication_status: "created" });
    expect(cli.createCalls).toBe(1);
  });

  it("converts a ready pull request back to a draft on an explicit draft publish", async () => {
    const github = service();
    await github.publish(run(), READY_REQUEST);

    const drafted = await github.publish(run(), DRAFT_REQUEST);

    expect(cli.modeInputs.map((input) => input.draft)).toEqual([true]);
    expect(drafted.row.status).toBe("draft");
  });

  it("surfaces a refused mode change as an actionable publication failure", async () => {
    const github = service();
    await github.publish(run(), DRAFT_REQUEST);
    cli.modeError = new GitHubCliError(
      "github_pr_mode_failed",
      "GitHub could not mark the pull request ready for review.",
    );

    const result = await github.publish(run(), READY_REQUEST);

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_pr_mode_failed",
      status: "draft",
      number: 42,
    });
  });
});
