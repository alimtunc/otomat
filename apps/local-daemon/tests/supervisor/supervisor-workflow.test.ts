import {
  getRun,
  listAgentSessionsForRun,
  listIssues,
  listRuns,
  listStepRunsForRun,
} from "@otomat/db";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { readRunEvents } from "#events";
import { RuntimeUnavailableError } from "#runtime";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import {
  completedMarker,
  expectContiguousSeqs,
  providerSessionEvent,
  writeRunEvents,
} from "../support/run-event-fixtures.js";
import { seedWorkflowRun } from "../support/seed.js";
import { deadPid } from "../support/spawn.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fix.cleanup();
});

const THREE_STEPS = {
  version: 1 as const,
  steps: [
    { id: "plan", name: "Plan", agent: null, prompt: "plan it", depends_on: [] },
    { id: "implement", name: "Implement", agent: null, prompt: "build it", depends_on: ["plan"] },
    { id: "verify", name: "Verify", agent: null, prompt: "check it", depends_on: ["implement"] },
  ],
};

it("runs a three-step plan in order: three step_runs, three sessions, events per step", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");

  const run = await supervisor.start({ prompt: "the goal", plan: THREE_STEPS });
  await supervisor.settle();

  const settled = getRun(fix.db, run.id);
  expect(settled?.status).toBe("review_ready");

  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.name)).toEqual(["Plan", "Implement", "Verify"]);
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  expect(steps.map((step) => step.idx)).toEqual([0, 1, 2]);

  // The frozen plan carries the generated step ids and resolved runtimes.
  const planSteps = settled?.plan_json.steps ?? [];
  expect(planSteps.map((step) => step.id)).toEqual(steps.map((step) => step.id));
  expect(planSteps.every((step) => step.agent === "fake")).toBe(true);
  expect(planSteps[1]?.depends_on).toEqual([planSteps[0]?.id]);

  const sessions = listAgentSessionsForRun(fix.db, run.id);
  expect(sessions).toHaveLength(3);
  expect(new Set(sessions.map((s) => s.step_run_id)).size).toBe(3);
  expect(sessions.every((s) => s.status === "terminated")).toBe(true);

  expect(spawn.calls).toBe(3);
  expect(spawn.jobs.map((job) => job.stepRunId)).toEqual(steps.map((step) => step.id));
  expect(spawn.jobs.map((job) => job.prompt)).toEqual(["plan it", "build it", "check it"]);

  const events = readRunEvents(fix.db, run.id);
  expectContiguousSeqs(events);
  for (const step of steps) {
    expect(events.some((e) => e.step_run_id === step.id)).toBe(true);
  }
});

it("fail-fast: a failed step fails the run and cancels every step behind it", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "fail"]);

  const run = await supervisor.start({ prompt: "the goal", plan: THREE_STEPS });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "stale", "canceled"]);
  expect(spawn.calls).toBe(2);
});

it("a step crash with a live provider session interrupts the run without touching later steps", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "crash"]);

  const run = await supervisor.start({ prompt: "the goal", plan: THREE_STEPS });
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("awaiting_human");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "awaiting_human", "queued"]);
  expect(spawn.calls).toBe(2);
});

it("stop mid-workflow honors the active step's own end and cancels the rest", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["complete", "linger"]);

  const run = await supervisor.start({ prompt: "the goal", plan: THREE_STEPS });
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);

  await supervisor.abort(run.id);
  await supervisor.settle();

  expect(getRun(fix.db, run.id)?.status).toBe("canceled");
  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "canceled", "canceled"]);
  expect(spawn.calls).toBe(2);
});

it("rejects a plan step runtime that is unavailable before writing anything", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const issuesBefore = listIssues(fix.db).length;

  // The fake runtime stays enabled under Vitest; an empty PATH makes any real CLI unavailable.
  vi.stubEnv("PATH", "");
  await expect(
    supervisor.start({
      prompt: "the goal",
      plan: {
        version: 1,
        steps: [
          { id: "a", name: "A", agent: null, prompt: "pa", depends_on: [] },
          { id: "b", name: "B", agent: "claude", prompt: "pb", depends_on: ["a"] },
        ],
      },
    }),
  ).rejects.toThrow(RuntimeUnavailableError);

  expect(listRuns(fix.db)).toHaveLength(0);
  expect(listIssues(fix.db)).toHaveLength(issuesBefore);
  expect(spawn.calls).toBe(0);
});

it("boot mid-step: finished steps are never replayed and the torn step resumes", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedWorkflowRun(fix.db, {
    runId: "wf1",
    runStatus: "running",
    steps: [
      { id: "s1", status: "succeeded", session: { status: "terminated" } },
      {
        id: "s2",
        status: "running",
        dependsOn: ["s1"],
        session: { status: "active", pid: await deadPid() },
      },
      { id: "s3", status: "queued", dependsOn: ["s2"] },
    ],
  });
  const s1 = seeded("s1");
  const s2 = seeded("s2");
  writeRunEvents(fix.dataDir, "wf1", [
    providerSessionEvent(s1, "ps-s1"),
    completedMarker(s1, "ps-s1"),
    providerSessionEvent(s2, "ps-s2"),
  ]);

  supervisor.reconcile();

  expect(spawn.calls).toBe(0);
  expect(getRun(fix.db, "wf1")?.status).toBe("awaiting_human");
  let steps = listStepRunsForRun(fix.db, "wf1");
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "awaiting_human", "queued"]);

  await supervisor.resume("wf1");
  await supervisor.settle();

  expect(getRun(fix.db, "wf1")?.status).toBe("review_ready");
  steps = listStepRunsForRun(fix.db, "wf1");
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
  // One resume of s2's session plus a fresh s3 turn — s1 never respawned.
  expect(spawn.calls).toBe(2);
  expect(spawn.jobs[0]?.mode).toBe("resume");
  expect(spawn.jobs[0]?.stepRunId).toBe("s2");
  expect(spawn.jobs[1]?.mode).toBe("run");
  expect(spawn.jobs[1]?.stepRunId).toBe("s3");
  const sessions = listAgentSessionsForRun(fix.db, "wf1");
  expect(sessions.filter((s) => s.step_run_id === "s1")).toHaveLength(1);
  expect(sessions.filter((s) => s.step_run_id === "s2")).toHaveLength(1);
});

it("boot between steps: progression resumes without duplicating the finished step", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "wf2",
    runStatus: "running",
    steps: [
      { id: "s1", status: "succeeded", session: { status: "terminated" } },
      { id: "s2", status: "queued", dependsOn: ["s1"] },
    ],
  });

  supervisor.reconcile();
  expect(getRun(fix.db, "wf2")?.status).toBe("awaiting_human");
  expect(spawn.calls).toBe(0);

  await supervisor.resume("wf2");
  await supervisor.settle();

  expect(getRun(fix.db, "wf2")?.status).toBe("review_ready");
  expect(spawn.calls).toBe(1);
  expect(spawn.jobs[0]?.stepRunId).toBe("s2");
  const sessions = listAgentSessionsForRun(fix.db, "wf2");
  expect(sessions.filter((s) => s.step_run_id === "s1")).toHaveLength(1);
});

it("boot after a step's marker landed but before its settle: no replay of that step", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const seeded = seedWorkflowRun(fix.db, {
    runId: "wf3",
    runStatus: "running",
    steps: [
      {
        id: "s1",
        status: "running",
        session: { status: "active", pid: await deadPid() },
      },
      { id: "s2", status: "queued", dependsOn: ["s1"] },
    ],
  });
  const s1 = seeded("s1");
  writeRunEvents(fix.dataDir, "wf3", [
    providerSessionEvent(s1, "ps-s1"),
    completedMarker(s1, "ps-s1"),
  ]);

  supervisor.reconcile();

  expect(getRun(fix.db, "wf3")?.status).toBe("awaiting_human");
  expect(listStepRunsForRun(fix.db, "wf3").map((step) => step.status)).toEqual([
    "succeeded",
    "queued",
  ]);

  await supervisor.resume("wf3");
  await supervisor.settle();

  expect(getRun(fix.db, "wf3")?.status).toBe("review_ready");
  expect(spawn.calls).toBe(1);
  expect(spawn.jobs[0]?.stepRunId).toBe("s2");
});
