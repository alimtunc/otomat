import { getRun, listAgentSessionsForRun, listStepRunsForRun } from "@otomat/db";
import { supervisionEntries } from "@otomat/domain";
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

const IMPLEMENT_THEN_REVIEW = {
  version: 1 as const,
  steps: [
    { id: "build", name: "Implement", agent: null, depends_on: [] },
    { id: "review", name: "Goal review", agent: null, depends_on: ["build"] },
  ],
};

interface SupervisedLaunch {
  behaviors: WorkerBehavior[];
  maxLoops?: number;
  budgetUsd?: number | null;
}

async function launch({ behaviors, maxLoops = 3, budgetUsd = null }: SupervisedLaunch) {
  const { supervisor, spawn } = makeSupervisor(fix, behaviors);
  const run = await supervisor.start({
    prompt: "the goal",
    plan: IMPLEMENT_THEN_REVIEW,
    supervision: { runtime: "fake", max_loops: maxLoops, budget_usd: budgetUsd },
  });
  await supervisor.settle();
  return { supervisor, spawn, run, steps: listStepRunsForRun(fix.db, run.id) };
}

function decisionFor(runId: string, stepRunId: string) {
  return supervisionEntries(readRunEvents(fix.db, runId)).get(stepRunId);
}

it("freezes the supervisor at launch and wakes it after the step delivers", async () => {
  const { run, spawn, steps } = await launch({
    behaviors: ["complete", "supervise-pass", "complete", "supervise-pass"],
  });

  expect(getRun(fix.db, run.id)?.supervision_json?.config.runtime).toBe("fake");
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
  // Two step turns, each followed by its own supervision turn — nothing stayed resident between them.
  expect(spawn.calls).toBe(4);
  const supervisions = listAgentSessionsForRun(fix.db, run.id).filter(
    (session) => session.kind === "supervision",
  );
  expect(supervisions).toHaveLength(2);
  expect(supervisions.every((session) => session.status === "terminated")).toBe(true);
});

it("keeps the dependent queued until the supervisor passes", async () => {
  const { run, spawn, steps } = await launch({ behaviors: ["complete", "supervise-blocked"] });

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(2);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  expect(decisionFor(run.id, steps[0]?.id ?? "")).toMatchObject({
    state: "decided",
    decision: { decision: "blocked" },
  });
});

it("releases nothing when the supervisor answers in prose alone", async () => {
  const { run, spawn, steps } = await launch({ behaviors: ["complete", "supervise-silent"] });

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(2);
  expect(decisionFor(run.id, steps[0]?.id ?? "")).toMatchObject({ state: "unavailable" });
});

it("rests the run when the supervisor turn itself dies, releasing nothing", async () => {
  const { run, spawn, steps } = await launch({ behaviors: ["complete", "crash"] });

  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(spawn.calls).toBe(2);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  expect(decisionFor(run.id, steps[0]?.id ?? "")).toMatchObject({ state: "unavailable" });
});

it("sends needs_changes instructions to a new turn of the same step, then re-judges it", async () => {
  const { run, spawn, steps } = await launch({
    behaviors: ["complete", "supervise-changes", "write", "supervise-pass"],
  });

  // Implement, its judgement, the remediation turn it asked for, its second judgement, then Goal review and its own.
  expect(spawn.calls).toBe(6);
  const remediation = spawn.jobs[2];
  expect(remediation?.stepRunId).toBe(steps[0]?.id);
  expect(remediation?.mode).toBe("resume");
  expect(remediation?.prompt).toContain("implement it for real");
  expect(listStepRunsForRun(fix.db, run.id)[0]?.status).toBe("succeeded");
});

it("blocks the run when a step exhausts its supervision rounds", async () => {
  const { run, spawn, steps } = await launch({
    behaviors: ["complete", "supervise-changes"],
    maxLoops: 1,
  });

  expect(spawn.calls).toBe(2);
  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  expect(decisionFor(run.id, steps[0]?.id ?? "")).toMatchObject({
    state: "unavailable",
    reason: expect.stringContaining("supervision rounds"),
  });
});

it("blocks the run when supervision has spent its budget", async () => {
  const { run, spawn, steps } = await launch({
    behaviors: ["complete", "supervise-changes"],
    budgetUsd: 0.1,
  });

  expect(spawn.calls).toBe(2);
  expect(steps.map((step) => step.status)).toEqual(["awaiting_human", "queued"]);
  expect(decisionFor(run.id, steps[0]?.id ?? "")).toMatchObject({
    state: "unavailable",
    reason: expect.stringContaining("budget"),
  });
});

it("leaves an unsupervised run untouched", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ prompt: "the goal", plan: IMPLEMENT_THEN_REVIEW });
  await supervisor.settle();

  expect(spawn.calls).toBe(2);
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "succeeded",
  ]);
});
