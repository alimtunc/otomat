import { getRun, listStepRunsForRun } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import type { WorkerBehavior } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const PLAN = {
  version: 1 as const,
  steps: [
    { id: "build", name: "Implement", agent: null, depends_on: [] },
    { id: "review", name: "Goal review", agent: null, depends_on: ["build"] },
  ],
};

async function launch(behaviors: WorkerBehavior[]) {
  const { supervisor, spawn } = makeSupervisor(fix, behaviors);
  const run = await supervisor.start({ prompt: "the goal", plan: PLAN });
  await supervisor.settle();
  return { run, supervisor, spawn, steps: listStepRunsForRun(fix.db, run.id) };
}

it("holds a step that exited 0 with its own question still unanswered", async () => {
  const { run, spawn, steps } = await launch(["ask-complete", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(1);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  const blocked = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.delivery_blocked",
  );
  expect(blocked?.payload["reason"]).toMatch(/unanswered/);
  expect(blocked?.payload["pending_interactions"]).toBe(1);
});

it("releases a turn that ended with nothing asked, even one that left the workspace untouched", async () => {
  const { spawn, steps } = await launch(["complete", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
  expect(spawn.calls).toBe(2);
});

it("starts the dependent only on an explicit override, and records it", async () => {
  const { run, supervisor, spawn } = await launch(["ask-complete", "complete"]);
  const held = listStepRunsForRun(fix.db, run.id)[0];

  supervisor.overrideStepDelivery(run.id, held?.id ?? "", "answered out of band");
  await supervisor.settle();

  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "succeeded",
  ]);
  expect(spawn.calls).toBe(2);
  const override = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.guard_override",
  );
  expect(override?.payload).toMatchObject({
    step_name: "Implement",
    note: "answered out of band",
  });
});

it("makes the dependent eligible once the held step resumes and ends with no open ask", async () => {
  const { run, supervisor, spawn } = await launch(["ask-complete", "complete", "complete"]);
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "awaiting_human",
    "queued",
  ]);

  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "succeeded",
  ]);
  expect(spawn.calls).toBe(3);
});

it("refuses a second override, because the guard is no longer holding the step", async () => {
  const { run, supervisor } = await launch(["ask-complete", "complete"]);
  const held = listStepRunsForRun(fix.db, run.id)[0];

  supervisor.overrideStepDelivery(run.id, held?.id ?? "", "answered out of band");
  await supervisor.settle();

  expect(() => supervisor.overrideStepDelivery(run.id, held?.id ?? "", "again")).toThrow(
    /nothing is being held/,
  );
});

it("refuses an override on a step nothing is holding", async () => {
  const { run, supervisor } = await launch(["complete", "complete"]);
  const done = listStepRunsForRun(fix.db, run.id)[0];

  expect(() => supervisor.overrideStepDelivery(run.id, done?.id ?? "", "accepted by hand")).toThrow(
    /nothing is being held/,
  );
});
