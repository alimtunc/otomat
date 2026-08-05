import { existsSync } from "node:fs";
import { join } from "node:path";

import { getIssue, updateIssueStatus } from "@otomat/db";
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

afterEach(() => {
  fix.cleanup();
});

function config() {
  return { db: fix.db, repositories: stubRepositoryResolver(worktrees, fix.repositoryId) };
}

it("releases the worktree and its branch, and closes the issue", () => {
  closeMergedRun(config(), RUN_ID);

  expect(existsSync(worktreePath)).toBe(false);
  expect(branches(fix.repo)).not.toContain(BRANCH);
  expect(worktrees.list({ status: "removed" }).map((row) => row.owner)).toContain(RUN_ID);
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
});

it("settles again without complaining once there is nothing left to release", () => {
  closeMergedRun(config(), RUN_ID);

  expect(() => closeMergedRun(config(), RUN_ID)).not.toThrow();
  expect(getIssue(fix.db, "i1")?.status).toBe("done");
});

it("leaves a canceled issue in the state its user chose", () => {
  updateIssueStatus(fix.db, "i1", "canceled");

  closeMergedRun(config(), RUN_ID);

  expect(getIssue(fix.db, "i1")?.status).toBe("canceled");
  expect(existsSync(worktreePath)).toBe(false);
});

it("does nothing for a run that no longer exists", () => {
  expect(() => closeMergedRun(config(), "r-gone")).not.toThrow();
  expect(existsSync(worktreePath)).toBe(true);
});
