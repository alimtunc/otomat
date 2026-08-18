import { listAgentSessionsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

it("captures a git boundary at both ends of a completed turn", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "implement the thing" });
  await supervisor.settle();

  const session = listAgentSessionsForRun(fix.db, run.id)[0];
  expect(session?.boundary_error).toBeNull();
  expect(session?.start_tree_sha).toMatch(/^[0-9a-f]{40}$/);
  expect(session?.end_tree_sha).toMatch(/^[0-9a-f]{40}$/);
  expect(session?.start_head_sha).toMatch(/^[0-9a-f]{40}$/);
  expect(session?.end_head_sha).toMatch(/^[0-9a-f]{40}$/);
});

it("closes the boundary of a turn that failed, so its delta stays readable", async () => {
  const { supervisor } = makeSupervisor(fix, "fail");

  const run = await supervisor.start({ prompt: "break something" });
  await supervisor.settle();

  const session = listAgentSessionsForRun(fix.db, run.id)[0];
  expect(session?.start_tree_sha).not.toBeNull();
  expect(session?.end_tree_sha).not.toBeNull();
});

it("gives every pass of a multi-step run its own boundary", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({
    prompt: "implement the thing",
    plan: {
      version: 1,
      steps: [
        { id: "a", name: "A", agent: null, note: "first", depends_on: [] },
        { id: "b", name: "B", agent: null, note: "second", depends_on: ["a"] },
      ],
    },
  });
  await supervisor.settle();

  const sessions = listAgentSessionsForRun(fix.db, run.id);
  expect(sessions).toHaveLength(2);
  // Each pass is measured between its own two trees, never a neighbour's.
  expect(sessions.every((session) => session.start_tree_sha !== null)).toBe(true);
  expect(sessions.every((session) => session.end_tree_sha !== null)).toBe(true);
});
