import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  insertPullRequest,
  markRunAbandoned,
  updateIssueStatus,
  writeAutoDeleteWorkspaces,
  type Db,
} from "@otomat/db";
import type { WorkspaceEntry } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { createGitWorktreeService, createRepositoryResolver, type GitWorktreeService } from "#git";
import { listWorktrees } from "#git/worktree-cli";
import {
  cleanupWorkspace,
  cycleHolders,
  findWorkspaceEntry,
  listWorkspaces,
  reconcileWorkspaces,
  type WorkspaceContext,
} from "#supervisor/workspaces/index";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedRun } from "../support/seed.js";

const RUN_ID = "r-merged";
const BRANCH = `otomat/run/${RUN_ID}`;
const OPEN_RUN_ID = "r-open";

let fix: DaemonTestDb;
let worktrees: GitWorktreeService;
let worktreesRoot: string;
let worktreePath: string;
let worktreeId: string;
let context: WorkspaceContext;
let alive: string[];

beforeEach(() => {
  fix = setupDaemonDb();
  worktreesRoot = join(fix.dataDir, "worktrees");
  worktrees = createGitWorktreeService({
    db: fix.db,
    repositoryId: fix.repositoryId,
    repoRoot: fix.repo.root,
    defaultBranch: fix.repo.defaultBranch,
    worktreesRoot,
  });
  const acquired = worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
  worktreePath = acquired.path;
  worktreeId = acquired.id;
  seedRun(fix.db, {
    runId: RUN_ID,
    worktreeId,
    runStatus: "completed",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  alive = [];
  context = bootContext();
});

/** What a daemon builds at startup: nothing about a workspace survives in memory between two of these. */
function bootContext(): WorkspaceContext {
  return {
    db: fix.db,
    dataDir: fix.dataDir,
    repositories: createRepositoryResolver({ db: fix.db, worktreesRoot }),
    busyRuns: (runId) => alive.includes(runId),
    refreshPullRequests: null,
  };
}

afterEach(() => {
  fix.cleanup();
});

function mergePullRequest(db: Db = fix.db, headRef = BRANCH): void {
  insertPullRequest(db, {
    id: `pr-${headRef}`,
    issue_id: "i1",
    run_id: RUN_ID,
    repository_id: fix.repositoryId,
    number: 42,
    url: "https://github.com/acme/app/pull/42",
    status: "merged",
    publication_status: "created",
    title: "feat: ship it",
    head_ref: headRef,
  });
}

function entryFor(path: string): WorkspaceEntry {
  const found = listWorkspaces(context).entries.find((entry) => entry.path === path);
  if (!found) throw new Error(`no workspace entry for ${path}`);
  return found;
}

function openCycle(): string {
  const acquired = worktrees.acquire({ owner: OPEN_RUN_ID, branch: `otomat/run/${OPEN_RUN_ID}` });
  seedRun(fix.db, {
    runId: OPEN_RUN_ID,
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  return acquired.path;
}

function registeredPaths(): string[] {
  return listWorktrees(fix.repo.root).map((entry) => entry.path);
}

it("clears a merged cycle whose worktree is clean, and leaves no git registration behind", async () => {
  mergePullRequest();
  expect(entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });

  const report = await reconcileWorkspaces(context);

  expect(report.cleaned).toBe(1);
  expect(existsSync(worktreePath)).toBe(false);
  expect(registeredPaths()).not.toContain(worktreePath);
  expect(worktrees.list({ status: "removed" }).map((row) => row.id)).toContain(worktreeId);
});

it("prunes a directory deleted by hand and converges the record it left behind", async () => {
  rmSync(worktreePath, { recursive: true, force: true });
  expect(entryFor(worktreePath).state).toBe("stale");

  const report = await reconcileWorkspaces(context);

  expect(report.pruned).toBe(1);
  expect(report.converged).toBe(1);
  expect(registeredPaths()).not.toContain(worktreePath);
  expect(worktrees.list({ status: "removed" }).map((row) => row.id)).toContain(worktreeId);
  // The record is converged, so a second pass has nothing left to say about it.
  expect((await reconcileWorkspaces(context)).converged).toBe(0);
});

it("keeps a dirty worktree, names why, and cleans it once the change is gone", async () => {
  mergePullRequest();
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");

  const blocked = await reconcileWorkspaces(context);

  expect(blocked.cleaned).toBe(0);
  expect(blocked.skipped).toBe(1);
  expect(entryFor(worktreePath)).toMatchObject({
    state: "cleanup_required",
    blocker: "worktree_dirty",
    dirty: true,
  });

  rmSync(join(worktreePath, "scratch.txt"));

  expect((await reconcileWorkspaces(context)).cleaned).toBe(1);
  expect(existsSync(worktreePath)).toBe(false);
});

it("keeps a workspace whose run still has a live writer", async () => {
  mergePullRequest();
  alive = [RUN_ID];

  const report = await reconcileWorkspaces(context);

  expect(report.cleaned).toBe(0);
  expect(entryFor(worktreePath).blocker).toBe("writer_alive");
  expect(existsSync(worktreePath)).toBe(true);
});

it("leaves a worktree created outside Otomat unmanaged and untouched", async () => {
  const external = join(fix.dataDir, "by-hand");
  fix.repo.git("worktree", "add", "-b", "by-hand", external, "HEAD");
  mergePullRequest();

  await reconcileWorkspaces(context);

  expect(entryFor(external)).toMatchObject({
    state: "unmanaged",
    attachment: "none",
    blocker: "unmanaged_worktree",
    issue_id: null,
  });
  expect(existsSync(external)).toBe(true);
});

it("refuses to attach a worktree that only looks like one of Otomat's", async () => {
  const lookalike = join(worktreesRoot, "looks-like-otomat");
  fix.repo.git("worktree", "add", "-b", "otomat/run/impostor", lookalike, "HEAD");

  await reconcileWorkspaces(context);

  expect(entryFor(lookalike)).toMatchObject({
    state: "unmanaged",
    attachment: "ambiguous",
    run_id: null,
  });
  expect(existsSync(lookalike)).toBe(true);
});

it("keeps the workspace when the host turned automatic deletion off, and still cleans it by hand", async () => {
  mergePullRequest();
  writeAutoDeleteWorkspaces(fix.db, false);

  const report = await reconcileWorkspaces(context);

  expect(report.cleaned).toBe(0);
  expect(report.skipped).toBe(1);
  expect(entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });

  const result = cleanupWorkspace(context, entryFor(worktreePath));

  expect(result.outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
});

it("refuses a targeted cleanup while a blocker stands, and answers null for an unknown workspace", () => {
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");

  const blocked = cleanupWorkspace(context, entryFor(worktreePath));

  expect(blocked).toMatchObject({ outcome: "skipped", blocker: "worktree_dirty" });
  expect(existsSync(worktreePath)).toBe(true);
  expect(findWorkspaceEntry(context, "wt-gone", cycleHolders(fix.db))).toBeNull();
});

it("deletes nothing on its own while no merge stands for the branch, and still deletes it by hand", async () => {
  const report = await reconcileWorkspaces(context);

  expect(report).toMatchObject({ cleaned: 0, skipped: 1 });
  expect(entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });
  expect(cleanupWorkspace(context, entryFor(worktreePath)).outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
});

it("stops reading a closed issue's workspace as active, whatever its run still says", () => {
  const path = openCycle();
  expect(entryFor(path)).toMatchObject({ state: "active", blocker: "cycle_open" });

  updateIssueStatus(fix.db, "i1", "done");

  expect(entryFor(path)).toMatchObject({ state: "cleanup_required", blocker: null });
});

it("releases a canceled issue's worktree without deleting the work still in it", async () => {
  const path = openCycle();
  insertPullRequest(fix.db, {
    id: "pr-dropped",
    issue_id: "i1",
    run_id: OPEN_RUN_ID,
    repository_id: fix.repositoryId,
    number: 43,
    url: "https://github.com/acme/app/pull/43",
    status: "closed",
    publication_status: "created",
    title: "feat: drop it",
    head_ref: `otomat/run/${OPEN_RUN_ID}`,
  });
  writeFileSync(join(path, "scratch.txt"), "work in progress\n");
  updateIssueStatus(fix.db, "i1", "canceled");

  expect(entryFor(path)).toMatchObject({ state: "cleanup_required", blocker: "worktree_dirty" });
  expect((await reconcileWorkspaces(context)).cleaned).toBe(0);
  expect(cleanupWorkspace(context, entryFor(path))).toMatchObject({
    outcome: "skipped",
    blocker: "worktree_dirty",
  });
  expect(existsSync(path)).toBe(true);
});

it("closes the cycle on an abandon and leaves its worktree for an explicit deletion", async () => {
  const path = openCycle();
  markRunAbandoned(fix.db, OPEN_RUN_ID, new Date().toISOString());

  expect(entryFor(path)).toMatchObject({ state: "cleanup_required", blocker: null });
  expect((await reconcileWorkspaces(context)).cleaned).toBe(0);
  expect(existsSync(path)).toBe(true);
  expect(cleanupWorkspace(context, entryFor(path)).outcome).toBe("cleaned");
});

it("counts the maintenance states and narrows to one run's own workspaces", () => {
  fix.repo.git("worktree", "add", "-b", "by-hand", join(fix.dataDir, "by-hand"), "HEAD");

  const inventory = listWorkspaces(context);

  expect(inventory.counts).toMatchObject({ active: 0, cleanup_required: 1, unmanaged: 1 });
  expect(listWorkspaces(context, { runId: RUN_ID }).entries.map((entry) => entry.path)).toEqual([
    worktreePath,
  ]);
});

it("answers the same after a restart, and the retry that follows still cleans", async () => {
  mergePullRequest();
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");
  await reconcileWorkspaces(context);

  const restarted = bootContext();

  expect(
    listWorkspaces(restarted).entries.find((entry) => entry.path === worktreePath),
  ).toMatchObject({ state: "cleanup_required", blocker: "worktree_dirty" });

  rmSync(join(worktreePath, "scratch.txt"));

  expect((await reconcileWorkspaces(restarted)).cleaned).toBe(1);
  expect(existsSync(worktreePath)).toBe(false);
});

it("reads a merge Otomat only adopted, matched on the branch its pull request names", () => {
  insertPullRequest(fix.db, {
    id: "pr-adopted",
    issue_id: "i1",
    run_id: null,
    repository_id: fix.repositoryId,
    number: 7,
    url: "https://github.com/acme/app/pull/7",
    status: "merged",
    origin: "imported",
    provenance: "external",
    title: "someone else's pull request",
    head_ref: BRANCH,
  });

  expect(entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });
});
