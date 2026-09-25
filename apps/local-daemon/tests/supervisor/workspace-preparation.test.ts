import { readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { preparedWorkspace, schema, updateIssueStatus } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { findWorktreeById } from "#git/worktrees-store";
import { setupDaemonDb, type DaemonTestDb } from "#test-support/daemon-db";
import { makeSupervisor } from "#test-support/supervisor";

let fix: DaemonTestDb;
beforeEach(() => {
  fix = setupDaemonDb();
});
afterEach(() => {
  fix.cleanup();
});

it("prepares once without a run, then adopts the same worktree and manual edits", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const [first, second] = await Promise.all([
    supervisor.prepareIssueWorkspace("i1"),
    supervisor.prepareIssueWorkspace("i1"),
  ]);
  expect(first).toBe(second);
  const row = findWorktreeById(fix.db, first);
  expect(row).toBeDefined();
  if (!row) throw new Error("workspace missing");
  writeFileSync(join(row.path, "manual.txt"), "human work");
  expect(spawn.calls).toBe(0);
  expect(fix.db.select().from(schema.runs).all()).toHaveLength(0);
  expect(fix.db.select().from(schema.agentSessions).all()).toHaveLength(0);
  expect((await supervisor.workspaces()).entries.find((entry) => entry.id === first)).toMatchObject(
    { issue_id: "i1", run_id: null, state: "active" },
  );
  const run = await supervisor.start({ issue_id: "i1" });
  await supervisor.settle();
  expect(run.worktree_id).toBe(first);
  expect(run.branch).toBe(row.branch);
  expect(spawn.jobs[0]?.worktreePath).toBe(row.path);
  expect(readFileSync(join(row.path, "manual.txt"), "utf8")).toBe("human work");
  expect(preparedWorkspace(fix.db, "i1")).toBeUndefined();
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
});

it("keeps preparation across restart and refuses a missing or replaced path", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const id = await supervisor.prepareIssueWorkspace("i1");
  const row = findWorktreeById(fix.db, id);
  if (!row) throw new Error("workspace missing");
  const { supervisor: restarted } = makeSupervisor(fix, "complete");
  expect(await restarted.prepareIssueWorkspace("i1")).toBe(id);
  renameSync(row.path, `${row.path}-old`);
  await expect(restarted.prepareIssueWorkspace("i1")).rejects.toThrow();
  symlinkSync(fix.repo.root, row.path);
  await expect(restarted.prepareIssueWorkspace("i1")).rejects.toThrow(/path has changed/);
  await expect(restarted.start({ issue_id: "i1" })).rejects.toThrow();
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
});

it("keeps manual work on a refused launch and closes preparation when the issue closes", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const id = await supervisor.prepareIssueWorkspace("i1");
  await expect(supervisor.start({ issue_id: "i1", runtime: "missing" })).rejects.toThrow();
  expect(preparedWorkspace(fix.db, "i1")?.id).toBe(id);
  expect(spawn.calls).toBe(0);
  updateIssueStatus(fix.db, "i1", "done");
  expect(preparedWorkspace(fix.db, "i1")).toBeUndefined();
  await expect(supervisor.prepareIssueWorkspace("i1")).rejects.toThrow(/closed/);
  updateIssueStatus(fix.db, "i1", "ready");
  expect(await supervisor.prepareIssueWorkspace("i1")).not.toBe(id);
});
