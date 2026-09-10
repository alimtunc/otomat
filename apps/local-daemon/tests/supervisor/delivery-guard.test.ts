import { getRun, listStepRunsForRun } from "@otomat/db";
import type { DeliveryExpectation } from "@otomat/domain";
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

function plan(delivery: DeliveryExpectation) {
  return {
    version: 1 as const,
    steps: [
      { id: "build", name: "Implement", agent: null, delivery, depends_on: [] },
      { id: "review", name: "Goal review", agent: null, depends_on: ["build"] },
    ],
  };
}

async function launch(delivery: DeliveryExpectation, behaviors: WorkerBehavior[]) {
  const { supervisor, spawn } = makeSupervisor(fix, behaviors);
  const run = await supervisor.start({ prompt: "the goal", plan: plan(delivery) });
  await supervisor.settle();
  return { run, spawn, steps: listStepRunsForRun(fix.db, run.id) };
}

it("holds a step that exited 0 with its own question still unanswered", async () => {
  const { run, spawn, steps } = await launch("standard", ["ask-complete", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(1);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  const blocked = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.delivery_blocked",
  );
  expect(blocked?.payload["reason"]).toMatch(/unanswered/);
});

it("holds an implementation step that only audited, so goal review never starts", async () => {
  const { spawn, steps } = await launch("implementation", ["complete", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(1);
});

it("journals the evidence snapshot it blocked on", async () => {
  const { run } = await launch("implementation", ["complete", "complete"]);

  const blocked = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.delivery_blocked",
  );
  expect(blocked?.payload["expectation"]).toBe("implementation");
  expect(blocked?.payload["evidence"]).toMatchObject({
    changed_files: 0,
    committed: false,
    pending_interactions: 0,
    evidence_error: null,
  });
});

it("releases an implementation step that changed the workspace", async () => {
  const { spawn, steps } = await launch("implementation", ["write", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
  expect(spawn.calls).toBe(2);
});

it("holds an implementation step whose observed command failed", async () => {
  const { run, spawn, steps } = await launch("implementation", ["failed-command", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(1);
  const blocked = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.delivery_blocked",
  );
  expect(blocked?.payload["reason"]).toMatch(/1 of the 1 commands/);
});

it("lets an analysis step finish honestly without a diff", async () => {
  const { spawn, steps } = await launch("analysis", ["complete", "complete"]);

  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
  expect(spawn.calls).toBe(2);
});

it("starts the dependent only on an explicit override, and records it", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "the goal", plan: plan("implementation") });
  await supervisor.settle();
  const held = listStepRunsForRun(fix.db, run.id)[0];

  supervisor.overrideStepDelivery(run.id, held?.id ?? "", "audited by hand");
  await supervisor.settle();

  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "succeeded",
  ]);
  expect(spawn.calls).toBe(2);
  const override = readRunEvents(fix.db, run.id).findLast(
    (event) => event.type === "run.guard_override",
  );
  expect(override?.payload).toMatchObject({ step_name: "Implement", note: "audited by hand" });
});

it("makes the dependent eligible only once the held step resumes and delivers", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["ask-complete", "write", "complete"]);
  const run = await supervisor.start({ prompt: "the goal", plan: plan("implementation") });
  await supervisor.settle();
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
  const { supervisor } = makeSupervisor(fix, ["complete", "complete"]);
  const run = await supervisor.start({ prompt: "the goal", plan: plan("implementation") });
  await supervisor.settle();
  const held = listStepRunsForRun(fix.db, run.id)[0];

  supervisor.overrideStepDelivery(run.id, held?.id ?? "", "audited by hand");
  await supervisor.settle();

  expect(() => supervisor.overrideStepDelivery(run.id, held?.id ?? "", "again")).toThrow(
    /nothing is being held/,
  );
});

it("refuses an override on a step nothing is holding", async () => {
  const { supervisor } = makeSupervisor(fix, ["write", "complete"]);
  const run = await supervisor.start({ prompt: "the goal", plan: plan("implementation") });
  await supervisor.settle();
  const done = listStepRunsForRun(fix.db, run.id)[0];

  expect(() => supervisor.overrideStepDelivery(run.id, done?.id ?? "", "accepted by hand")).toThrow(
    /nothing is being held/,
  );
});
