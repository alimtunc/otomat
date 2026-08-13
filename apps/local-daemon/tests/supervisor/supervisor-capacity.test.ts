import { getRun, readMaxConcurrentSessions } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const THREE_STEPS = {
  version: 1 as const,
  steps: [
    { id: "plan", name: "Plan", agent: null, note: "plan it", depends_on: [] },
    { id: "implement", name: "Implement", agent: null, note: "build it", depends_on: ["plan"] },
    { id: "verify", name: "Verify", agent: null, note: "check it", depends_on: ["implement"] },
  ],
};

it("ships with four slots and answers what the host is doing with them", async () => {
  const { supervisor } = makeSupervisor(fix, "linger");

  expect(supervisor.capacity()).toEqual({
    max_concurrent_sessions: 4,
    active_sessions: 0,
    waiting_sessions: 0,
  });

  const run = await supervisor.start({ prompt: "one" });
  expect(await waitFor(() => supervisor.capacity().active_sessions === 1)).toBe(true);
  expect(supervisor.capacity().waiting_sessions).toBe(0);

  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("answers a saturated launch at once with a queued run naming its place in line", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const holder = await supervisor.start({ prompt: "holds the only slot" });
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);

  const queued = await supervisor.start({ prompt: "the next one" });

  expect(queued.status).toBe("queued");
  expect(supervisor.waitFor(queued.id)).toEqual({
    kind: "concurrency_limit",
    position: 1,
    active_sessions: 1,
    max_concurrent_sessions: 1,
  });
  expect(getRun(fix.db, queued.id)?.status).toBe("queued");
  expect(spawn.calls).toBe(1);

  await supervisor.abort(holder.id);
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);
  await supervisor.abort(queued.id);
  await supervisor.settle();
});

it("aborting a queued run removes its waiter at once, without granting it a slot first", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const holder = await supervisor.start({ prompt: "holds the only slot" });
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);
  const queued = await supervisor.start({ prompt: "waits in line" });
  expect(supervisor.waitFor(queued.id)).toMatchObject({ position: 1 });

  await supervisor.abort(queued.id);

  expect(supervisor.capacity().waiting_sessions).toBe(0);
  expect(getRun(fix.db, queued.id)?.status).toBe("canceled");
  expect(getRun(fix.db, holder.id)?.status).toBe("running");

  await supervisor.abort(holder.id);
  await supervisor.settle();
  expect(spawn.calls).toBe(1);
});

it("drains the queue in launch order as slots free up", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const first = await supervisor.start({ prompt: "a" });
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);
  const second = await supervisor.start({ prompt: "b" });
  const third = await supervisor.start({ prompt: "c" });

  expect(supervisor.waitFor(second.id)).toMatchObject({ position: 1 });
  expect(supervisor.waitFor(third.id)).toMatchObject({ position: 2 });

  await supervisor.abort(first.id);
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);
  expect(spawn.jobs[1]?.prompt).toContain("## Issue: b");
  expect(supervisor.waitFor(third.id)).toMatchObject({ position: 1 });

  await supervisor.abort(second.id);
  expect(await waitFor(() => spawn.calls === 3)).toBe(true);
  expect(spawn.jobs[2]?.prompt).toContain("## Issue: c");

  await supervisor.abort(third.id);
  await supervisor.settle();
});

it("raising the cap drains the queue immediately, with no daemon restart", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const runs = [await supervisor.start({ prompt: "a" })];
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);
  runs.push(await supervisor.start({ prompt: "b" }));
  runs.push(await supervisor.start({ prompt: "c" }));
  expect(supervisor.capacity()).toMatchObject({ active_sessions: 1, waiting_sessions: 2 });

  expect(supervisor.setCapacity(3)).toMatchObject({ max_concurrent_sessions: 3 });

  expect(await waitFor(() => spawn.calls === 3)).toBe(true);
  expect(readMaxConcurrentSessions(fix.db)).toBe(3);
  for (const run of runs) expect(supervisor.waitFor(run.id)).toBeNull();

  for (const run of runs) await supervisor.abort(run.id);
  await supervisor.settle();
});

it("lowering the cap never stops a live session and only holds the next launch back", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 2 });
  const first = await supervisor.start({ prompt: "a" });
  const second = await supervisor.start({ prompt: "b" });
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);

  expect(supervisor.setCapacity(1)).toEqual({
    max_concurrent_sessions: 1,
    active_sessions: 2,
    waiting_sessions: 0,
  });
  expect(getRun(fix.db, first.id)?.status).toBe("running");
  expect(getRun(fix.db, second.id)?.status).toBe("running");

  const third = await supervisor.start({ prompt: "c" });
  expect(supervisor.waitFor(third.id)).toMatchObject({ kind: "concurrency_limit", position: 1 });
  expect(spawn.calls).toBe(2);

  // Back under the lowered cap: one ending session is not enough, two are.
  await supervisor.abort(first.id);
  expect(await waitFor(() => supervisor.capacity().active_sessions === 1)).toBe(true);
  expect(spawn.calls).toBe(2);

  await supervisor.abort(second.id);
  expect(await waitFor(() => spawn.calls === 3)).toBe(true);
  await supervisor.abort(third.id);
  await supervisor.settle();
});

it("keeps the cap across a daemon restart", () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  supervisor.setCapacity(7);

  const rebooted = makeSupervisor(fix, "complete");

  expect(rebooted.supervisor.capacity()).toMatchObject({ max_concurrent_sessions: 7 });
});

it("refuses a cap that is not a positive integer, leaving the live limit alone", () => {
  const { supervisor } = makeSupervisor(fix, "complete");

  expect(() => supervisor.setCapacity(0)).toThrow(RangeError);
  expect(() => supervisor.setCapacity(2.5)).toThrow(RangeError);
  expect(() => supervisor.setCapacity(-3)).toThrow(RangeError);

  expect(supervisor.capacity().max_concurrent_sessions).toBe(4);
  expect(readMaxConcurrentSessions(fix.db)).toBe(4);
});

it("names the plan node a stalled run waits on instead of blaming the slot limit", async () => {
  const { supervisor } = makeSupervisor(fix, ["complete", "crash"]);
  const run = await supervisor.start({ prompt: "the goal", plan: THREE_STEPS });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  expect(supervisor.waitFor(run.id)).toEqual({
    kind: "workflow_dependency",
    blocked_by: ["Implement"],
  });
});

it("reports no wait for a run with nothing left to start", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "do it" });
  await supervisor.settle();

  expect(supervisor.waitFor(run.id)).toBeNull();
});
