import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getPullRequestForRun,
  getRun,
  updatePullRequest,
  updateRunStatus,
  type PullRequestRow,
} from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGitWorktreeService, headSha, type GitWorktreeService } from "#git";
import { createGitHubService, GitHubCliError, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver, type TestRepo } from "../support/git.js";
import { FakeGitHubCli, publishRequest } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-push";
const BRANCH = `otomat/run/${RUN_ID}`;
const READY_REQUEST = publishRequest("ship it");

describe("pull request pushes", () => {
  let fix: DaemonTestDb;
  let repo: TestRepo;
  let worktrees: GitWorktreeService;
  let worktreePath: string;
  let cli: FakeGitHubCli;
  let github: GitHubService;

  beforeEach(async () => {
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
    github = createGitHubService({
      db: fix.db,
      dataDir: fix.dataDir,
      repositories: stubRepositoryResolver(worktrees),
      cli,
      idFactory: () => "pr-local-1",
    });
    const run = getRun(fix.db, RUN_ID);
    if (!run) throw new Error("seeded run missing");
    await github.publish(run, READY_REQUEST);
  });

  afterEach(() => {
    fix.cleanup();
  });

  const commitInWorkspace = (content: string, message: string): string => {
    writeFileSync(join(worktreePath, "change.txt"), content);
    repo.git("-C", worktreePath, "add", "-A");
    repo.git("-C", worktreePath, "commit", "--no-verify", "-m", message);
    return headSha(worktreePath);
  };

  /** A commit the fake remote gained on its own: same parent, never in this workspace's history. */
  const commitOnlyOnRemote = (parent: string): string => {
    const sha = repo
      .git("commit-tree", `${parent}^{tree}`, "-p", parent, "-m", "remote work")
      .trim();
    cli.remoteHeads.set(BRANCH, sha);
    return sha;
  };

  const row = (): PullRequestRow => {
    const stored = getPullRequestForRun(fix.db, RUN_ID);
    if (!stored) throw new Error("pull request row missing");
    return stored;
  };

  const publishedHead = (): string => {
    const sha = row().published_head_sha;
    if (sha === null) throw new Error("pull request carries no published head");
    return sha;
  };

  it("reports local commits as pushable and publishes them on request", async () => {
    const local = commitInWorkspace("first\nsecond\n", "follow up");

    const before = await github.getPullRequest(RUN_ID);
    expect(before?.sync).toMatchObject({
      state: "ahead",
      dirty: false,
      local_head_sha: local,
    });
    expect(before?.sync?.ahead.map((commit) => commit.subject)).toEqual(["follow up"]);

    const pushed = await github.pushCommits(RUN_ID, {});

    expect(cli.remoteHeads.get(BRANCH)).toBe(local);
    expect(pushed.sync).toMatchObject({ state: "in_sync", remote_head_sha: local, ahead: [] });
    expect(pushed.row.published_head_sha).toBe(local);
    expect(pushed.row.published_diff_sha).toBe(worktrees.commitDiff(RUN_ID, local).sha);
    expect(cli.forcePushes).toEqual([]);
  });

  it("leaves uncommitted work unpublished and says so after a push", async () => {
    const local = commitInWorkspace("first\nsecond\n", "follow up");
    writeFileSync(join(worktreePath, "change.txt"), "first\nsecond\nuncommitted\n");

    const pushed = await github.pushCommits(RUN_ID, {});

    expect(pushed.sync).toMatchObject({ state: "in_sync", dirty: true });
    expect(pushed.row.published_head_sha).toBe(local);
    expect(repo.git("-C", worktreePath, "status", "--porcelain").trim()).not.toBe("");
  });

  it("never commits for the user: a dirty-only workspace pushes nothing new", async () => {
    const published = publishedHead();
    writeFileSync(join(worktreePath, "change.txt"), "first\nuncommitted\n");

    const pushed = await github.pushCommits(RUN_ID, {});

    expect(pushed.sync).toMatchObject({ state: "in_sync", dirty: true, ahead: [] });
    expect(pushed.row.published_head_sha).toBe(published);
    expect(repo.git("-C", worktreePath, "log", "--format=%s", "-1").trim()).toBe("feat: ship it");
  });

  it("pushes an open pull request whose run is no longer review ready", async () => {
    const local = commitInWorkspace("first\nsecond\n", "follow up");
    updateRunStatus(fix.db, RUN_ID, { status: "completed" });

    const pushed = await github.pushCommits(RUN_ID, {});

    expect(pushed.sync).toMatchObject({ state: "in_sync" });
    expect(cli.remoteHeads.get(BRANCH)).toBe(local);
  });

  it("reports divergence and refuses to force push on its own", async () => {
    const local = commitInWorkspace("first\nsecond\n", "follow up");
    const remote = commitOnlyOnRemote(publishedHead());
    cli.pushError = new GitHubCliError(
      "github_push_rejected",
      `GitHub rejected the push to ${BRANCH}: the remote branch has commits this workspace does not.`,
    );

    const compared = await github.getPullRequest(RUN_ID);
    expect(compared?.sync).toMatchObject({
      state: "diverged",
      local_head_sha: local,
      remote_head_sha: remote,
    });
    expect(compared?.sync?.replaced.map((commit) => commit.sha)).toEqual([remote]);

    await expect(github.pushCommits(RUN_ID, {})).rejects.toMatchObject({
      code: "github_push_rejected",
    });
    expect(cli.forcePushes).toEqual([]);
    expect(row()).toMatchObject({
      publication_status: "created",
      error_code: "github_push_rejected",
    });
  });

  it("replaces the diverged branch only under a lease on the sha that was read", async () => {
    const local = commitInWorkspace("first\nsecond\n", "follow up");
    const remote = commitOnlyOnRemote(publishedHead());

    const pushed = await github.pushCommits(RUN_ID, { expected_remote_sha: remote });

    expect(cli.forcePushes).toEqual([
      { cwd: worktreePath, remote: "origin", branch: BRANCH, expectedRemoteSha: remote },
    ]);
    expect(pushed.sync).toMatchObject({ state: "in_sync", remote_head_sha: local });
    expect(pushed.row.published_head_sha).toBe(local);
  });

  it("loses nothing when the lease is stale and asks for a fresh comparison", async () => {
    commitInWorkspace("first\nsecond\n", "follow up");
    const seen = commitOnlyOnRemote(publishedHead());
    const moved = commitOnlyOnRemote(seen);

    await expect(github.pushCommits(RUN_ID, { expected_remote_sha: seen })).rejects.toMatchObject({
      code: "github_push_lease_stale",
    });

    expect(cli.forcePushes).toEqual([]);
    expect(cli.remoteHeads.get(BRANCH)).toBe(moved);
    expect(row().error_code).toBe("github_push_lease_stale");
  });

  it("refuses to rewrite a branch GitHub protects", async () => {
    commitInWorkspace("first\nsecond\n", "follow up");
    const remote = commitOnlyOnRemote(publishedHead());
    cli.protectedBranches.add(BRANCH);

    await expect(github.pushCommits(RUN_ID, { expected_remote_sha: remote })).rejects.toMatchObject(
      { code: "force_push_branch_protected" },
    );
    expect(cli.forcePushes).toEqual([]);
  });

  it("refuses to rewrite a base branch even when the pull request ships it", async () => {
    commitInWorkspace("first\nsecond\n", "follow up");
    updatePullRequest(fix.db, row().id, { head_ref: repo.defaultBranch });
    cli.provider = { ...cli.provider, headRef: repo.defaultBranch };

    await expect(
      github.pushCommits(RUN_ID, { expected_remote_sha: publishedHead() }),
    ).rejects.toMatchObject({ code: "force_push_base_branch" });
    expect(cli.forcePushes).toEqual([]);
  });

  it("refuses to push a branch the pull request no longer ships", async () => {
    commitInWorkspace("first\nsecond\n", "follow up");
    cli.provider = { ...cli.provider, headRef: "someone/else" };

    await expect(github.pushCommits(RUN_ID, {})).rejects.toMatchObject({
      code: "pr_head_mismatch",
    });
    expect(cli.pushCalls).toBe(1);
  });

  it("refuses to push to a merged pull request", async () => {
    commitInWorkspace("first\nsecond\n", "follow up");
    cli.provider = { ...cli.provider, lifecycle: "merged" };

    await expect(github.pushCommits(RUN_ID, {})).rejects.toMatchObject({ code: "pr_not_open" });
    expect(cli.pushCalls).toBe(1);
  });

  it("refuses to push before a pull request exists", async () => {
    await expect(github.pushCommits("r-none", {})).rejects.toMatchObject({
      code: "pr_not_published",
    });
  });
});
