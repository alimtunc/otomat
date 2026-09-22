import { getRun, listAgentSessionsForRun, listStepRunsForRun, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { StepCancelRefusedError } from "#supervisor";

import { contributeToStep } from "../support/contribution.js";
import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { waitFor } from "../support/poll.js";
import { seedWorkflowRun } from "../support/seed.js";
import { appendStepInput, makeSupervisor } from "../support/supervisor.js";

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

const FOLLOW_UP = appendStepInput({ note: "one more thing" });

const THREE_STEPS = {
  version: 1 as const,
  steps: [
    { id: "implement", name: "Implement", agent: null, note: "build it", depends_on: [] },
    { id: "review", name: "Review", agent: null, note: "check it", depends_on: ["implement"] },
    { id: "polish", name: "Polish", agent: null, note: "shine it", depends_on: ["implement"] },
  ],
};

function withdrawnEvents(runId: string) {
  return readRunEvents(fix.db, runId).filter((event) => event.type === "step.lifecycle");
}

it("withdraws a follow-up queued behind a live turn; the turn's settle then lands the run on its delivered work", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "running")).toBe(true);
  const [implement] = listStepRunsForRun(fix.db, run.id);
  if (!implement) throw new Error("plan seeded no step");
  expect(
    await waitFor(() =>
      readRunEvents(fix.db, run.id).some((event) => event.type === "runtime.provider_session"),
    ),
  ).toBe(true);
  const appended = await supervisor.appendStep(run.id, FOLLOW_UP);
  const followUp = appended.plan_json.steps.at(-1);
  if (!followUp) throw new Error("expected an appended step");
  expect(listStepRunsForRun(fix.db, run.id).at(-1)?.status).toBe("queued");

  const withdrawn = supervisor.cancelStep(run.id, followUp.id);

  expect(withdrawn.status).toBe("withdrawn");
  expect(getRun(fix.db, run.id)?.status).toBe("running");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "running",
    "withdrawn",
  ]);
  expect(getRun(fix.db, run.id)?.plan_json.steps).toHaveLength(2);
  expect(withdrawnEvents(run.id)).toEqual([
    expect.objectContaining({
      step_run_id: followUp.id,
      payload: expect.objectContaining({
        status: "withdrawn",
        step_name: "Follow up",
        reason: "canceled by the operator before it started",
      }),
    }),
  ]);
  expect(() => supervisor.cancelStep(run.id, followUp.id)).toThrow(
    expect.objectContaining({ code: "step_not_queued" }),
  );
  expect(() => supervisor.cancelStep(run.id, implement.id)).toThrow(
    expect.objectContaining({ code: "step_not_queued" }),
  );

  await supervisor.stopStep(run.id, implement.id);
  await contributeToStep(fix.db, supervisor, run.id, implement.id, "carry on");
  expect(await waitFor(() => spawn.calls >= 2)).toBe(true);
  await supervisor.settle();

  expect(spawn.calls).toBe(2);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "withdrawn",
  ]);
});

it("unqueues a turn waiting for a slot, leaves its dependent blocked, and lets a replacement reopen the path", async () => {
  const { supervisor, spawn } = makeSupervisor(
    fix,
    ["complete", "linger", "complete", "complete"],
    {
      concurrency: 1,
    },
  );
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  const holder = await supervisor.start({ prompt: "holds the only slot" });
  expect(await waitFor(() => spawn.calls === 2)).toBe(true);

  const withA = await supervisor.appendStep(run.id, { ...FOLLOW_UP, name: "A" });
  const a = withA.plan_json.steps.at(-1);
  if (!a) throw new Error("expected step A");
  expect(supervisor.waitFor(run.id)).toMatchObject({ kind: "concurrency_limit", position: 1 });
  const withB = await supervisor.appendStep(run.id, { ...FOLLOW_UP, name: "B", dependsOn: [a.id] });
  const b = withB.plan_json.steps.at(-1);
  if (!b) throw new Error("expected step B");

  supervisor.cancelStep(run.id, a.id);

  expect(supervisor.capacity().waiting_sessions).toBe(0);
  expect(await waitFor(() => supervisor.waitFor(run.id) === null)).toBe(true);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "withdrawn",
    "queued",
  ]);
  const aSessions = listAgentSessionsForRun(fix.db, run.id).filter(
    (session) => session.step_run_id === a.id,
  );
  expect(aSessions.map((session) => session.status)).toEqual(["terminated"]);
  expect(spawn.calls).toBe(2);

  await supervisor.appendStep(run.id, { ...FOLLOW_UP, name: "C", replaces: a.id });
  await supervisor.abort(holder.id);
  expect(await waitFor(() => spawn.calls === 4)).toBe(true);
  await supervisor.settle();

  expect(spawn.jobs.slice(2).map((job) => job.prompt.includes("one more thing"))).toEqual([
    true,
    true,
  ]);
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "withdrawn",
    "succeeded",
    "succeeded",
  ]);
});

it("refuses to withdraw the plan's last reachable work, an unknown step, or a step of another run", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger", { concurrency: 1 });
  const holder = await supervisor.start({ prompt: "holds the only slot" });
  expect(await waitFor(() => spawn.calls === 1)).toBe(true);
  const queued = await supervisor.start({ issue_id: "i-work" });
  const [only] = listStepRunsForRun(fix.db, queued.id);
  if (!only) throw new Error("plan seeded no step");

  expect(() => supervisor.cancelStep(queued.id, only.id)).toThrow(
    expect.objectContaining({ code: "step_last_work" }),
  );
  expect(() => supervisor.cancelStep(holder.id, only.id)).toThrow(
    expect.objectContaining({ code: "step_not_found" }),
  );
  expect(() => supervisor.cancelStep(queued.id, "missing")).toThrow(StepCancelRefusedError);
  expect(listStepRunsForRun(fix.db, queued.id)[0]?.status).toBe("queued");
  expect(supervisor.waitFor(queued.id)).toMatchObject({ kind: "concurrency_limit" });

  await supervisor.abort(queued.id);
  await supervisor.abort(holder.id);
  await supervisor.settle();
});

it("survives a restart: reconciliation keeps the withdrawn step and lands the run on what it delivered", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "torn",
    runStatus: "running",
    steps: [
      { id: "implement", status: "succeeded" },
      { id: "review", status: "withdrawn", dependsOn: ["implement"] },
      { id: "polish", status: "queued", dependsOn: ["review"] },
    ],
  });

  const report = supervisor.reconcile();

  expect(report.reconciled).toHaveLength(1);
  expect(getRun(fix.db, "torn")?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, "torn").map((step) => step.status)).toEqual([
    "succeeded",
    "withdrawn",
    "queued",
  ]);
  expect(supervisor.waitFor("torn")).toBeNull();
  expect(supervisor.resumePlan("torn")).toEqual({
    mode: "unavailable",
    reason: expect.any(String),
  });
});

it("never resurrects a withdrawn step: a resume of the canceled run requeues only the steps the stop canceled", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["linger", "complete", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work", plan: THREE_STEPS });
  expect(await waitFor(() => getRun(fix.db, run.id)?.status === "running")).toBe(true);
  expect(
    await waitFor(() =>
      readRunEvents(fix.db, run.id).some((event) => event.type === "runtime.provider_session"),
    ),
  ).toBe(true);

  const review = listStepRunsForRun(fix.db, run.id).find((step) => step.name === "Review");
  if (!review) throw new Error("plan seeded no review step");

  supervisor.cancelStep(run.id, review.id);
  await supervisor.abort(run.id);
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("canceled");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "canceled",
    "withdrawn",
    "canceled",
  ]);

  await supervisor.resume(run.id);
  await supervisor.settle();

  expect(spawn.calls).toBe(3);
  expect(spawn.jobs[2]?.prompt).toContain("shine it");
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
  expect(listStepRunsForRun(fix.db, run.id).map((step) => step.status)).toEqual([
    "succeeded",
    "withdrawn",
    "succeeded",
  ]);
});

it("re-reads a run left awaiting a step that no longer exists", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "paused",
    runStatus: "awaiting_human",
    steps: [
      { id: "implement", status: "succeeded" },
      { id: "review", status: "queued", dependsOn: ["implement"] },
    ],
  });

  const withdrawn = supervisor.cancelStep("paused", "review");

  expect(withdrawn.status).toBe("withdrawn");
  expect(getRun(fix.db, "paused")?.status).toBe("review_ready");
  expect(
    readRunEvents(fix.db, "paused")
      .filter((event) => event.type === "run.lifecycle")
      .map((event) => event.payload["run_status"]),
  ).toEqual(["review_ready"]);
});
