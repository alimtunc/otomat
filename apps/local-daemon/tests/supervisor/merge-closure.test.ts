import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getIssue,
  getRun,
  insertPullRequest,
  updateIssueStatus,
  writeAutoDeleteWorkspaces,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createGitWorktreeService, type GitWorktreeService } from "#git";
import { closeMergedRun } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { branches, stubRepositoryResolver } from "../support/git.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-merged";
const BRANCH = `otomat/run/${RUN_ID}`;

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let worktreePath: string;

beforeEach(() => {
  fix = setupDaemonDb();
  worktrees = createGitWorktreeService({
    db: fix.db,
    repositoryId: fix.repositoryId,
    repoRoot: fix.repo.root,
    defaultBranch: fix.repo.defaultBranch,
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
});

function seedMergedPullRequest(): void {
  insertPullRequest(fix.db, {
    id: "pr-merged",
    issue_id: "i1",
    run_id: RUN_ID,
    repository_id: fix.repositoryId,
    number: 12,
    url: "https://github.com/acme/app/pull/12",
    status: "merged",
    publication_status: "created",
    title: "feat: ship it",
    head_ref: BRANCH,
  });
}

afterEach(() => {
  fix.cleanup();
});

function config() {
  return {
    db: fix.db,
    dataDir: fix.dataDir,
    repositories: stubRepositoryResolver(worktrees, {
      repositoryId: fix.repositoryId,
      rootPath: fix.repo.root,
      worktreesRoot: join(fix.dataDir, "worktrees"),
    }),
  };
}

it("releases the worktree and its branch, and closes the run and its issue", () => {
  seedMergedPullRequest();

  closeMergedRun(config(), RUN_ID);

  expect(existsSync(worktreePath)).toBe(false);
  expect(branches(fix.repo)).not.toContain(BRANCH);
  expect(worktrees.list({ status: "removed" }).map((row) => row.owner)).toContain(RUN_ID);
  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
});

it("settles again without complaining once there is nothing left to release", () => {
  seedMergedPullRequest();
  closeMergedRun(config(), RUN_ID);

  expect(() => closeMergedRun(config(), RUN_ID)).not.toThrow();
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
});

it("leaves a canceled issue in the state its user chose", () => {
  seedMergedPullRequest();
  updateIssueStatus(fix.db, "i1", "canceled");

  closeMergedRun(config(), RUN_ID);

  expect(getIssue(fix.db, "i1")?.status).toBe("canceled");
  expect(existsSync(worktreePath)).toBe(false);
});

it("closes the cycle but keeps the worktree while no merged pull request stands for it", () => {
  closeMergedRun(config(), RUN_ID);

  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
  expect(existsSync(worktreePath)).toBe(true);
  expect(branches(fix.repo)).toContain(BRANCH);
});

it("keeps the worktree when the project turned automatic deletion off", () => {
  seedMergedPullRequest();
  writeAutoDeleteWorkspaces(fix.db, "p1", false);

  closeMergedRun(config(), RUN_ID);

  expect(getIssue(fix.db, "i1")?.status).toBe("done");
  expect(existsSync(worktreePath)).toBe(true);
});

it("does nothing for a run that no longer exists", () => {
  expect(() => closeMergedRun(config(), "r-gone")).not.toThrow();
  expect(existsSync(worktreePath)).toBe(true);
});
