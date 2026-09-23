import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  getRun,
  insertProject,
  insertPullRequest,
  markRunAbandoned,
  updateIssueStatus,
  type Db,
} from "@otomat/db";
import type { WorkspaceEntry } from "@otomat/domain";
import { afterEach, beforeEach, expect, it } from "vitest";

import { runEventsPath } from "#events";
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

beforeEach(async () => {
  fix = setupDaemonDb();
  worktreesRoot = join(fix.dataDir, "worktrees");
  worktrees = createGitWorktreeService({
    db: fix.db,
    repositoryId: fix.repositoryId,
    repoRoot: fix.repo.root,
    defaultBranch: fix.repo.defaultBranch,
    worktreesRoot,
  });
  const acquired = await worktrees.acquire({ owner: RUN_ID, branch: BRANCH });
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

async function entryFor(path: string, from: WorkspaceContext = context): Promise<WorkspaceEntry> {
  const found = (await listWorkspaces(from)).entries.find((entry) => entry.path === path);
  if (!found) throw new Error(`no workspace entry for ${path}`);
  return found;
}

function forcedCleanups(runId: string): boolean[] {
  const forced: boolean[] = [];
  for (const line of readFileSync(runEventsPath(fix.dataDir, runId), "utf8").split("\n")) {
    if (line === "") continue;
    // SAFETY: the daemon wrote this file itself, one lifecycle event per line.
    const event = JSON.parse(line) as { payload?: { phase?: string; forced?: boolean } };
    if (event.payload?.phase === "workspace_cleaned") forced.push(event.payload.forced === true);
  }
  return forced;
}

async function openCycle(): Promise<string> {
  const acquired = await worktrees.acquire({
    owner: OPEN_RUN_ID,
    branch: `otomat/run/${OPEN_RUN_ID}`,
  });
  seedRun(fix.db, {
    runId: OPEN_RUN_ID,
    worktreeId: acquired.id,
    runStatus: "review_ready",
    stepStatus: "succeeded",
    sessionStatus: "terminated",
  });
  return acquired.path;
}

async function registeredPaths(): Promise<string[]> {
  return (await listWorktrees(fix.repo.root)).map((entry) => entry.path);
}

it("refreshes a merged, clean, auto-deletable workspace without deleting it", async () => {
  mergePullRequest();
  expect(await entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });

  const report = await reconcileWorkspaces(context);

  expect(report).toMatchObject({ pruned: 0, converged: 0 });
  expect(existsSync(worktreePath)).toBe(true);
  expect(await registeredPaths()).toContain(worktreePath);
  expect(report.inventory.entries.find((entry) => entry.path === worktreePath)).toMatchObject({
    state: "cleanup_required",
    blocker: null,
  });
});

it("clears a merged cycle by hand, and leaves no git registration behind", async () => {
  mergePullRequest();

  const result = await cleanupWorkspace(context, await entryFor(worktreePath));

  expect(result.outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
  expect(await registeredPaths()).not.toContain(worktreePath);
  expect(worktrees.list({ status: "removed" }).map((row) => row.id)).toContain(worktreeId);
});

it("prunes a directory deleted by hand and converges the record it left behind", async () => {
  rmSync(worktreePath, { recursive: true, force: true });
  expect((await entryFor(worktreePath)).state).toBe("stale");

  const report = await reconcileWorkspaces(context);

  expect(report.pruned).toBe(1);
  expect(report.converged).toBe(1);
  expect(await registeredPaths()).not.toContain(worktreePath);
  expect(worktrees.list({ status: "removed" }).map((row) => row.id)).toContain(worktreeId);
  // The record is converged, so a second pass has nothing left to say about it.
  expect((await reconcileWorkspaces(context)).converged).toBe(0);
});

it("keeps a dirty worktree, names why, and cleans it by hand once the change is gone", async () => {
  mergePullRequest();
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");

  expect(await entryFor(worktreePath)).toMatchObject({
    state: "cleanup_required",
    blocker: "worktree_dirty",
    uncommitted_files: 1,
  });
  expect((await cleanupWorkspace(context, await entryFor(worktreePath))).outcome).toBe("skipped");

  rmSync(join(worktreePath, "scratch.txt"));

  expect((await cleanupWorkspace(context, await entryFor(worktreePath))).outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
});

it("keeps a workspace whose run still has a live writer", async () => {
  mergePullRequest();
  alive = [RUN_ID];

  expect((await entryFor(worktreePath)).blocker).toBe("writer_alive");
  expect(
    (await cleanupWorkspace(context, await entryFor(worktreePath), { force: true })).outcome,
  ).toBe("skipped");
  expect(existsSync(worktreePath)).toBe(true);
});

it("leaves a worktree created outside Otomat unmanaged, and removes it only by hand", async () => {
  const external = join(fix.dataDir, "by-hand");
  fix.repo.git("worktree", "add", "-b", "by-hand", external, "HEAD");

  await reconcileWorkspaces(context);

  expect(existsSync(external)).toBe(true);
  expect(await entryFor(external)).toMatchObject({
    state: "unmanaged",
    provenance: "external_worktree",
    blocker: null,
    issue_id: null,
    run_id: null,
  });

  const result = await cleanupWorkspace(context, await entryFor(external));

  expect(result).toMatchObject({ outcome: "cleaned", entry: { state: "removed" } });
  expect(existsSync(external)).toBe(false);
  expect(await registeredPaths()).not.toContain(external);
  expect(fix.repo.git("branch", "--list", "by-hand")).toContain("by-hand");
  expect(getRun(fix.db, RUN_ID)?.status).toBe("completed");
  expect(existsSync(runEventsPath(fix.dataDir, RUN_ID))).toBe(false);
});

it("refuses a dirty external worktree until forced, then discards its work and nothing else", async () => {
  const external = join(fix.dataDir, "by-hand");
  fix.repo.git("worktree", "add", "-b", "by-hand", external, "HEAD");
  writeFileSync(join(external, "scratch.txt"), "work in progress\n");

  expect(await entryFor(external)).toMatchObject({ state: "unmanaged", blocker: "worktree_dirty" });
  expect(await cleanupWorkspace(context, await entryFor(external))).toMatchObject({
    outcome: "skipped",
    blocker: "worktree_dirty",
  });
  expect(existsSync(external)).toBe(true);

  expect((await cleanupWorkspace(context, await entryFor(external), { force: true })).outcome).toBe(
    "cleaned",
  );
  expect(existsSync(external)).toBe(false);
  expect(fix.repo.git("branch", "--list", "by-hand")).toContain("by-hand");
});

it("reports git's own refusal of an external worktree instead of a deletion it never made", async () => {
  const external = join(fix.dataDir, "by-hand");
  fix.repo.git("worktree", "add", "-b", "by-hand", external, "HEAD");
  fix.repo.git("worktree", "lock", external);

  const result = await cleanupWorkspace(context, await entryFor(external), { force: true });

  expect(result).toMatchObject({ outcome: "failed", blocker: null });
  expect(result.message).toContain("locked");
  expect(existsSync(external)).toBe(true);
  expect(await registeredPaths()).toContain(external);
});

it("refuses to attach a worktree that only looks like one of Otomat's", async () => {
  const lookalike = join(worktreesRoot, "looks-like-otomat");
  fix.repo.git("worktree", "add", "-b", "otomat/run/impostor", lookalike, "HEAD");

  await reconcileWorkspaces(context);

  expect(await entryFor(lookalike)).toMatchObject({
    state: "unmanaged",
    provenance: "otomat_unreconciled",
    run_id: null,
    blocker: null,
  });

  const cleaned = await cleanupWorkspace(context, await entryFor(lookalike));

  expect(cleaned.outcome).toBe("cleaned");
  expect(existsSync(lookalike)).toBe(false);
  // No record verifies the cycle, so the branch it checked out survives the deletion.
  expect(fix.repo.git("branch", "--list", "otomat/run/impostor")).toContain("otomat/run/impostor");
});

it("refuses a targeted cleanup while a blocker stands, and answers null for an unknown workspace", async () => {
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");

  const blocked = await cleanupWorkspace(context, await entryFor(worktreePath));

  expect(blocked).toMatchObject({ outcome: "skipped", blocker: "worktree_dirty" });
  expect(existsSync(worktreePath)).toBe(true);
  expect(await findWorkspaceEntry(context, "wt-gone", cycleHolders(fix.db))).toBeNull();
});

it("deletes nothing on its own while no merge stands for the branch, and still deletes it by hand", async () => {
  await reconcileWorkspaces(context);

  expect(existsSync(worktreePath)).toBe(true);
  expect(await entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });
  expect((await cleanupWorkspace(context, await entryFor(worktreePath))).outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
});

it("stops reading a closed issue's workspace as active, whatever its run still says", async () => {
  const path = await openCycle();
  expect(await entryFor(path)).toMatchObject({ state: "active", blocker: "cycle_open" });

  updateIssueStatus(fix.db, "i1", "done");

  expect(await entryFor(path)).toMatchObject({ state: "cleanup_required", blocker: null });
});

it("releases a canceled issue's worktree without deleting the work still in it", async () => {
  const path = await openCycle();
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

  expect(await entryFor(path)).toMatchObject({
    state: "cleanup_required",
    blocker: "worktree_dirty",
  });
  await reconcileWorkspaces(context);
  expect(await cleanupWorkspace(context, await entryFor(path))).toMatchObject({
    outcome: "skipped",
    blocker: "worktree_dirty",
  });
  expect(existsSync(path)).toBe(true);
});

it("closes the cycle on an abandon and leaves its worktree for an explicit deletion", async () => {
  const path = await openCycle();
  markRunAbandoned(fix.db, OPEN_RUN_ID, new Date().toISOString());

  expect(await entryFor(path)).toMatchObject({ state: "cleanup_required", blocker: null });
  await reconcileWorkspaces(context);
  expect(existsSync(path)).toBe(true);
  expect((await cleanupWorkspace(context, await entryFor(path))).outcome).toBe("cleaned");
});

it("counts the maintenance states and narrows to one run's own workspaces", async () => {
  fix.repo.git("worktree", "add", "-b", "by-hand", join(fix.dataDir, "by-hand"), "HEAD");

  const inventory = await listWorkspaces(context);

  expect(inventory.counts).toMatchObject({ active: 0, cleanup_required: 1, unmanaged: 1 });
  expect(
    (await listWorkspaces(context, { runId: RUN_ID })).entries.map((entry) => entry.path),
  ).toEqual([worktreePath]);
});

it("answers for the asked project alone, so another project's worktrees never leak in", async () => {
  insertProject(fix.db, { id: "p2", name: "Other", root_path: join(fix.dataDir, "other") });

  expect(
    (await listWorkspaces(context, { projectId: "p1" })).entries.map((entry) => entry.path),
  ).toEqual([worktreePath]);
  expect((await listWorkspaces(context, { projectId: "p2" })).entries).toEqual([]);
});

it("answers the same after a restart, and the retry that follows still cleans", async () => {
  mergePullRequest();
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");
  await reconcileWorkspaces(context);

  const restarted = bootContext();

  expect(await entryFor(worktreePath, restarted)).toMatchObject({
    state: "cleanup_required",
    blocker: "worktree_dirty",
  });

  rmSync(join(worktreePath, "scratch.txt"));

  expect((await cleanupWorkspace(restarted, await entryFor(worktreePath, restarted))).outcome).toBe(
    "cleaned",
  );
  expect(existsSync(worktreePath)).toBe(false);
});

it("reads a merge Otomat only adopted, matched on the branch its pull request names", async () => {
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

  expect(await entryFor(worktreePath)).toMatchObject({ state: "cleanup_required", blocker: null });
});

it("forces a dirty worktree away only when asked, and deletes the branch its record names", async () => {
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");

  const protective = await cleanupWorkspace(context, await entryFor(worktreePath));

  expect(protective).toMatchObject({ outcome: "skipped", blocker: "worktree_dirty" });
  expect(existsSync(worktreePath)).toBe(true);

  const forced = await cleanupWorkspace(context, await entryFor(worktreePath), { force: true });

  expect(forced.outcome).toBe("cleaned");
  expect(existsSync(worktreePath)).toBe(false);
  expect(fix.repo.git("branch", "--list", BRANCH)).toBe("");
  expect(forcedCleanups(RUN_ID)).toEqual([true]);
});

it("refuses a directory git no longer registers rather than reporting a deletion git never made", async () => {
  const result = await cleanupWorkspace(
    context,
    { ...(await entryFor(worktreePath)), registered: false },
    { force: true },
  );

  expect(result.outcome).toBe("skipped");
  expect(result.message).toContain("refresh before deleting");
  expect(existsSync(worktreePath)).toBe(true);
});

it("counts the commits no remote holds, so a forced deletion can name what it loses", async () => {
  writeFileSync(join(worktreePath, "shipped.txt"), "done\n");
  fix.repo.git("-C", worktreePath, "add", "-A");
  fix.repo.git("-C", worktreePath, "commit", "-m", "feat: unpublished");

  expect(await entryFor(worktreePath)).toMatchObject({ unpushed_commits: 1, uncommitted_files: 0 });
});

it("converges a record whose directory is gone instead of asking git to remove it", async () => {
  rmSync(worktreePath, { recursive: true, force: true });

  const result = await cleanupWorkspace(context, await entryFor(worktreePath), { force: true });

  expect(result.outcome).toBe("cleaned");
  expect(await registeredPaths()).not.toContain(worktreePath);
  expect(worktrees.list({ status: "removed" }).map((row) => row.id)).toContain(worktreeId);
});

it("refuses a recorded worktree whose path is outside the worktrees root", async () => {
  const outside = join(fix.dataDir, "elsewhere");
  fix.repo.git("worktree", "add", "-b", "elsewhere", outside, "HEAD");

  const result = await cleanupWorkspace(
    context,
    { ...(await entryFor(worktreePath)), path: outside, present: true },
    { force: true },
  );

  expect(result.outcome).toBe("skipped");
  expect(result.message).toContain("outside the worktrees Otomat may delete");
  expect(existsSync(outside)).toBe(true);
});

it("reports each target of a batch on its own, so one refusal never hides the rest", async () => {
  const openPath = await openCycle();
  writeFileSync(join(worktreePath, "scratch.txt"), "work in progress\n");
  const external = join(fix.dataDir, "by-hand");
  fix.repo.git("worktree", "add", "-b", "by-hand", external, "HEAD");
  writeFileSync(join(external, "scratch.txt"), "work in progress\n");

  const outcomes: string[] = [];
  for (const path of [worktreePath, openPath, external]) {
    outcomes.push((await cleanupWorkspace(context, await entryFor(path))).outcome);
  }

  expect(outcomes).toEqual(["skipped", "skipped", "skipped"]);
  expect([worktreePath, openPath, external].every((path) => existsSync(path))).toBe(true);
  expect(
    (await cleanupWorkspace(context, await entryFor(worktreePath), { force: true })).outcome,
  ).toBe("cleaned");
  expect(existsSync(openPath)).toBe(true);
});
