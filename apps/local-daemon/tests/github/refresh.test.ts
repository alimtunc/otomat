import { existsSync } from "node:fs";
import { join } from "node:path";

import { getIssue, getPullRequest, getRun, insertPullRequest } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { createGitHubService, type GitHubService } from "#github";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { stubRepositoryResolver } from "../support/git.js";
import { FakeGitHubCli } from "../support/github.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-open";
const BRANCH = `otomat/run/${RUN_ID}`;

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let worktreePath: string;
let cli: FakeGitHubCli;
let github: GitHubService;

beforeEach(() => {
  fix = setupDaemonDb();
  const worktreesRoot = join(fix.dataDir, "worktrees");
  worktrees = createGitWorktreeService({
    db: fix.db,
    repositoryId: fix.repositoryId,
    repoRoot: fix.repo.root,
    defaultBranch: fix.repo.defaultBranch,
    worktreesRoot,
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
  cli = new FakeGitHubCli();
  cli.provider = { ...cli.provider, headRef: BRANCH };
  github = createGitHubService({
    db: fix.db,
    dataDir: fix.dataDir,
    repositories: stubRepositoryResolver(worktrees, {
      repositoryId: fix.repositoryId,
      rootPath: fix.repo.root,
      worktreesRoot,
    }),
    cli,
    idFactory: () => "pr-local-1",
  });
});

afterEach(() => {
  fix.cleanup();
});

function seedOpenPullRequest(overrides: {
  id: string;
  runId: string | null;
  number: number;
}): void {
  insertPullRequest(fix.db, {
    id: overrides.id,
    issue_id: "i1",
    run_id: overrides.runId,
    repository_id: fix.repositoryId,
    number: overrides.number,
    url: `https://github.com/acme/app/pull/${overrides.number}`,
    status: "open",
    publication_status: "created",
    title: "feat: ship it",
    head_ref: BRANCH,
    base_ref: "main",
  });
}

it("notices a merge made outside Otomat and closes the cycle with no panel open", async () => {
  seedOpenPullRequest({ id: "pr-local-1", runId: RUN_ID, number: 42 });
  cli.provider = { ...cli.provider, lifecycle: "merged" };

  const refreshed = await github.refreshTrackedPullRequests();

  expect(refreshed).toBe(1);
  expect(getPullRequest(fix.db, "pr-local-1")?.status).toBe("merged");
  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
  expect(existsSync(worktreePath)).toBe(false);
});

it("leaves a pull request GitHub still reports as open exactly where it was", async () => {
  seedOpenPullRequest({ id: "pr-local-1", runId: RUN_ID, number: 42 });

  await github.refreshTrackedPullRequests();

  expect(getPullRequest(fix.db, "pr-local-1")?.status).toBe("open");
  expect(existsSync(worktreePath)).toBe(true);
});

it("keeps every other pull request refreshable when one of them cannot be read", async () => {
  seedOpenPullRequest({ id: "pr-local-1", runId: RUN_ID, number: 42 });
  seedOpenPullRequest({ id: "pr-adopted", runId: null, number: 43 });

  const refreshed = await github.refreshTrackedPullRequests();

  // The adopted row is verified against the repository, which this fixture has no remote for.
  expect(refreshed).toBe(1);
  expect(getPullRequest(fix.db, "pr-local-1")?.status).toBe("open");
});

it("does not re-read a pull request already settled", async () => {
  insertPullRequest(fix.db, {
    id: "pr-merged",
    issue_id: "i1",
    run_id: RUN_ID,
    repository_id: fix.repositoryId,
    number: 42,
    status: "merged",
    publication_status: "created",
    title: "feat: ship it",
    head_ref: BRANCH,
  });

  expect(await github.refreshTrackedPullRequests()).toBe(0);
});
