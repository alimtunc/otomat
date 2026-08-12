import { listRuns, schema } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { findActiveByOwner } from "#git/worktrees-store";
import { issueWorkspace } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({ id: "i-work", project_id: "p1", title: "Continue me", status: "ready" })
    .run();
});

afterEach(() => {
  fix.cleanup();
});

/** Mirrors a merge: the run's worktree is released and the run lands terminal. */
function releaseWorkspace(runId: string): void {
  fix.db
    .update(schema.worktrees)
    .set({ status: "removed" })
    .where(eq(schema.worktrees.owner_token, runId))
    .run();
  fix.db.update(schema.runs).set({ status: "completed" }).where(eq(schema.runs.id, runId)).run();
}

it("projects the issue's open workspace onto the run that holds its branch", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();

  expect(issueWorkspace(fix.db, "i-work")).toEqual({
    state: "open",
    run_id: run.id,
    branch: run.branch,
    run_status: "review_ready",
    busy: false,
  });
});

it("keeps the cycle open after a cancel, and refuses a second launch until it is abandoned", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ issue_id: "i-work" });
  expect(await waitFor(() => issueWorkspace(fix.db, "i-work").busy)).toBe(true);

  await supervisor.abort(run.id);
  await supervisor.settle();

  expect(issueWorkspace(fix.db, "i-work")).toMatchObject({
    state: "open",
    run_id: run.id,
    run_status: "canceled",
    busy: false,
  });
  await expect(supervisor.start({ issue_id: "i-work" })).rejects.toMatchObject({
    code: "issue_workspace_open",
  });

  supervisor.abandon(run.id);
  expect(issueWorkspace(fix.db, "i-work").state).toBe("closed");
  const fresh = await supervisor.start({ issue_id: "i-work" });
  expect(fresh.id).not.toBe(run.id);
  await supervisor.abort(fresh.id);
  await supervisor.settle();
});

it("refuses to abandon a workspace whose run is still working, and leaves git untouched when it does", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ issue_id: "i-work" });
  expect(await waitFor(() => issueWorkspace(fix.db, "i-work").busy)).toBe(true);

  expect(() => supervisor.abandon(run.id)).toThrowError(/cancel the run/);

  await supervisor.abort(run.id);
  await supervisor.settle();
  const before = fix.db.select().from(schema.worktrees).all();
  supervisor.abandon(run.id);

  expect(fix.db.select().from(schema.worktrees).all()).toEqual(before);
  expect(listRuns(fix.db, { issueId: "i-work" })).toHaveLength(1);
});

it("refuses a second launch on an unmerged issue, naming the run that holds its workspace", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const first = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const spawnsAfterFirst = spawn.calls;

  await expect(supervisor.start({ issue_id: "i-work" })).rejects.toMatchObject({
    name: "LaunchRefusedError",
    code: "issue_workspace_open",
    runId: first.id,
  });

  // No hidden worktree, no phantom run: the refusal lands before any row is written.
  expect(listRuns(fix.db, { issueId: "i-work" })).toHaveLength(1);
  expect(spawn.calls).toBe(spawnsAfterFirst);
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
});

it("starts a fresh cycle once the merged issue's workspace is closed", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const first = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  releaseWorkspace(first.id);
  expect(issueWorkspace(fix.db, "i-work").state).toBe("closed");

  const second = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();

  expect(second.id).not.toBe(first.id);
  expect(second.branch).not.toBe(first.branch);
  expect(findActiveByOwner(fix.db, second.id)?.branch).toBe(second.branch);
  expect(issueWorkspace(fix.db, "i-work")).toMatchObject({ state: "open", run_id: second.id });
});

it("reports a workspace busy while its run still owns a live turn", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ issue_id: "i-work" });

  expect(await waitFor(() => issueWorkspace(fix.db, "i-work").busy)).toBe(true);
  expect(issueWorkspace(fix.db, "i-work")).toMatchObject({ run_id: run.id, busy: true });

  await supervisor.abort(run.id);
  await supervisor.settle();
});
