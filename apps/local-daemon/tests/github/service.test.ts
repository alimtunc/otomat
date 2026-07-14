import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { getPullRequestForRun, getRun, updatePullRequest } from "@otomat/db";
import type { GitHubConnectionContract } from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { createGitWorktreeService, type GitWorktreeService } from "#git";
import {
  createGitHubService,
  GitHubCliError,
  type GitHubCli,
  type GitHubPullRequest,
  type GitHubRemote,
  type PullRequestCreateInput,
  type PullRequestSelector,
  type PullRequestUpdateInput,
} from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRepository } from "../support/db.js";
import { setupTestRepo, type TestRepo } from "../support/git.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-github";
const BRANCH = `otomat/run/${RUN_ID}`;

const connected: GitHubConnectionContract = {
  status: "connected",
  login: "octocat",
  error_code: null,
  error_message: null,
};

class FakeGitHubCli implements GitHubCli {
  connectionValue: GitHubConnectionContract = connected;
  remote: GitHubRemote = { name: "origin", repository: "acme/otomat" };
  provider: GitHubPullRequest = {
    providerId: "PR_node_id",
    number: 42,
    url: "https://github.com/acme/otomat/pull/42",
    title: "Ship it",
    body: "Details",
    headRef: BRANCH,
    baseRef: "main",
    lifecycle: "open",
  };
  resolveError: GitHubCliError | null = null;
  pushError: GitHubCliError | null = null;
  createError: GitHubCliError | null = null;
  connectionError: GitHubCliError | null = null;
  providerExists = false;
  loginCalls = 0;
  pushCalls = 0;
  findCalls = 0;
  createCalls = 0;
  updateCalls = 0;

  async connection(): Promise<GitHubConnectionContract> {
    if (this.connectionError) throw this.connectionError;
    return this.connectionValue;
  }

  async login(): Promise<GitHubConnectionContract> {
    this.loginCalls += 1;
    this.connectionValue = connected;
    return this.connectionValue;
  }

  async resolveRemote(): Promise<GitHubRemote> {
    if (this.resolveError) throw this.resolveError;
    return this.remote;
  }

  async push(): Promise<void> {
    this.pushCalls += 1;
    if (this.pushError) throw this.pushError;
  }

  async findPullRequest(_input: PullRequestSelector): Promise<GitHubPullRequest | null> {
    this.findCalls += 1;
    return this.providerExists ? this.provider : null;
  }

  async viewPullRequest(): Promise<GitHubPullRequest> {
    return this.provider;
  }

  async createPullRequest(_input: PullRequestCreateInput): Promise<void> {
    this.createCalls += 1;
    if (this.createError) throw this.createError;
    this.providerExists = true;
  }

  async updatePullRequest(input: PullRequestUpdateInput): Promise<void> {
    this.updateCalls += 1;
    this.provider = { ...this.provider, title: input.title, body: input.body || null };
  }
}

describe("GitHubService", () => {
  let fix: DaemonTestDb;
  let repo: TestRepo;
  let worktrees: GitWorktreeService;
  let worktreePath: string;
  let cli: FakeGitHubCli;

  beforeEach(() => {
    fix = setupDaemonDb();
    repo = setupTestRepo();
    seedRepository(fix.db, repo.defaultBranch);
    worktrees = createGitWorktreeService({
      db: fix.db,
      repositoryId: "repo-1",
      repoRoot: repo.root,
      defaultBranch: repo.defaultBranch,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    });
    seedRun(fix.db, {
      runId: RUN_ID,
      runStatus: "review_ready",
      stepStatus: "succeeded",
      sessionStatus: "terminated",
    });
    worktreePath = worktrees.acquire({ owner: RUN_ID, branch: BRANCH }).path;
    writeFileSync(join(worktreePath, "change.txt"), "first\n");
    cli = new FakeGitHubCli();
  });

  afterEach(() => {
    repo.cleanup();
    fix.cleanup();
  });

  function run() {
    const row = getRun(fix.db, RUN_ID);
    if (!row) throw new Error("seeded run missing");
    return row;
  }

  function service(worktreeService: GitWorktreeService = worktrees) {
    return createGitHubService({
      db: fix.db,
      dataDir: fix.dataDir,
      worktrees: worktreeService,
      cli,
      idFactory: () => "pr-local-1",
    });
  }

  it("persists not_configured without touching git when authentication is missing", async () => {
    cli.connectionValue = {
      status: "disconnected",
      login: null,
      error_code: "github_auth_required",
      error_message: "Sign in to GitHub to continue.",
    };

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

    expect(result.row).toMatchObject({
      publication_status: "not_configured",
      number: null,
      url: null,
      error_code: "github_auth_required",
    });
    expect(cli.pushCalls).toBe(0);
    expect(cli.createCalls).toBe(0);
  });

  it("refuses publication when the canonical git diff is empty", async () => {
    writeFileSync(join(worktreePath, "change.txt"), "");
    repo.git("-C", worktreePath, "clean", "-fd");

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

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

    const result = await service(brokenWorktrees).publish(run(), {
      title: "Ship it",
      body: "Details",
    });

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

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

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

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_remote_missing",
      number: null,
      url: null,
    });
    expect(cli.pushCalls).toBe(0);
  });

  it("keeps confirmed metadata null when push fails", async () => {
    cli.pushError = new GitHubCliError(
      "github_push_failed",
      "The run branch could not be pushed to GitHub.",
    );

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

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

    const result = await service().publish(run(), { title: "Ship it", body: "Details" });

    expect(result.row).toMatchObject({
      publication_status: "failed",
      error_code: "github_pr_create_failed",
      number: null,
      url: null,
    });
  });

  it("snapshots, pushes, creates, persists and emits only confirmed metadata", async () => {
    const github = service();
    const result = await github.publish(run(), { title: "Ship it", body: "Details" });

    expect(result.row).toMatchObject({
      provider: "github",
      number: 42,
      url: "https://github.com/acme/otomat/pull/42",
      status: "open",
      publication_status: "created",
      title: "Ship it",
      body: "Details",
      head_ref: BRANCH,
      base_ref: "main",
      error_code: null,
      error_message: null,
    });
    expect(result.row.published_head_sha).toBe(worktrees.get(RUN_ID)?.headSha);
    expect(result.row.published_diff_sha).toBe(worktrees.diff(RUN_ID).sha);
    expect(result.hasUnpublishedChanges).toBe(false);
    expect(repo.git("-C", worktreePath, "status", "--porcelain").trim()).toBe("");
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);

    const events = readRunEvents(fix.db, RUN_ID);
    expect(events.map((event) => event.type)).toEqual(["pr.updated", "pr.updated", "pr.created"]);
    expect(events.map((event) => event.payload["publication_status"])).toEqual([
      "pushing",
      "creating",
      "created",
    ]);
    expect(events.at(-1)?.source).toBe("github");
  });

  it("reports an unknown change comparison instead of a false up-to-date state", async () => {
    await service().publish(run(), { title: "Ship it", body: "Details" });
    const brokenWorktrees: GitWorktreeService = {
      ...worktrees,
      diff() {
        throw new Error("git unavailable");
      },
    };

    expect(service(brokenWorktrees).getPullRequest(RUN_ID)?.hasUnpublishedChanges).toBeNull();
  });

  it("adopts an existing provider PR and never creates a duplicate", async () => {
    cli.providerExists = true;
    cli.provider = {
      ...cli.provider,
      title: "Existing provider title",
      body: "Existing provider body",
    };
    const github = service();

    const first = await github.publish(run(), { title: "Ship it", body: "Details" });
    const second = await github.publish(run(), {
      title: "Existing provider title",
      body: "Existing provider body",
    });

    expect(first.row.id).toBe(second.row.id);
    expect(first.row).toMatchObject({
      title: "Existing provider title",
      body: "Existing provider body",
    });
    expect(cli.createCalls).toBe(0);
    expect(cli.pushCalls).toBe(1);
    expect(getPullRequestForRun(fix.db, RUN_ID)?.number).toBe(42);
  });

  it("coalesces concurrent publication requests for one run", async () => {
    const github = service();

    const [first, second] = await Promise.all([
      github.publish(run(), { title: "Ship it", body: "Details" }),
      github.publish(run(), { title: "Ignored concurrent title", body: "Ignored" }),
    ]);

    expect(first.row.id).toBe(second.row.id);
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
  });

  it.each(["pushing", "creating"] as const)(
    "recovers an interrupted %s publication after daemon restart",
    async (publicationStatus) => {
      cli.connectionValue = {
        status: "disconnected",
        login: null,
        error_code: "github_auth_required",
        error_message: "Sign in to GitHub to continue.",
      };
      await service().publish(run(), { title: "Ship it", body: "Details" });
      const row = getPullRequestForRun(fix.db, RUN_ID);
      if (!row) throw new Error("local pull request missing");
      updatePullRequest(fix.db, row.id, { publication_status: publicationStatus });

      cli.connectionValue = connected;
      cli.providerExists = publicationStatus === "creating";
      const restarted = service();
      expect(restarted.getPullRequest(RUN_ID)?.row).toMatchObject({
        publication_status: "failed",
        error_code: "github_publication_interrupted",
      });

      const recovered = await restarted.publish(run(), { title: "Ship it", body: "Details" });

      expect(recovered.row).toMatchObject({
        publication_status: "created",
        number: 42,
        url: "https://github.com/acme/otomat/pull/42",
      });
      expect(cli.createCalls).toBe(publicationStatus === "creating" ? 0 : 1);
    },
  );

  it("updates the same open PR when the worktree changes", async () => {
    const github = service();
    await github.publish(run(), { title: "Ship it", body: "Details" });
    writeFileSync(join(worktreePath, "change.txt"), "first\nsecond\n");

    expect(github.getPullRequest(RUN_ID)?.hasUnpublishedChanges).toBe(true);
    const updated = await github.publish(run(), { title: "Ship it better", body: "New body" });

    expect(updated.row).toMatchObject({
      id: "pr-local-1",
      number: 42,
      publication_status: "created",
      title: "Ship it better",
      body: "New body",
    });
    expect(updated.hasUnpublishedChanges).toBe(false);
    expect(cli.pushCalls).toBe(2);
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(1);
  });

  it("refreshes merged lifecycle and refuses to publish another PR for the run", async () => {
    const github = service();
    await github.publish(run(), { title: "Ship it", body: "Details" });
    cli.provider = { ...cli.provider, lifecycle: "merged" };
    writeFileSync(join(worktreePath, "after-merge.txt"), "follow up\n");

    const result = await github.publish(run(), { title: "Another PR", body: "No" });

    expect(result.row).toMatchObject({ status: "merged", number: 42 });
    expect(cli.pushCalls).toBe(1);
    expect(cli.createCalls).toBe(1);
    expect(cli.updateCalls).toBe(0);
  });
});
