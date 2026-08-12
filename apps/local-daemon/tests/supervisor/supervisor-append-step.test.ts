import { getIssue, getRun, listStepRunsForRun, schema, updateIssueStatus } from "@otomat/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import { RunWorkspaceClosedError, type AppendStepInput, type ReconcileOutcome } from "#supervisor";

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

const FIX_STEP: AppendStepInput = {
  name: "Fix review comments",
  prompt: "address the review",
  selector: { kind: "runtime", runtimeId: "fake" },
  dependsOn: [],
  origin: "review_fix",
};

it("runs an appended step in the run's own worktree, with no second worktree", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");

  const first = spawn.jobs[0];
  const appended = await supervisor.appendStep(run.id, FIX_STEP);
  await supervisor.settle();

  expect(appended.branch).toBe(run.branch);
  expect(spawn.jobs).toHaveLength(2);
  expect(spawn.jobs[1]?.worktreePath).toBe(first?.worktreePath);
  expect(spawn.jobs[1]?.prompt).toBe("address the review");
  expect(spawn.jobs[1]?.mode).toBe("run");
  expect(getRun(fix.db, run.id)?.status).toBe("review_ready");
});

it("appends the step after the launched ones and never rewrites them", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const launched = getRun(fix.db, run.id)?.plan_json.steps ?? [];

  await supervisor.appendStep(run.id, FIX_STEP);
  await supervisor.settle();

  const revised = getRun(fix.db, run.id)?.plan_json.steps ?? [];
  expect(revised).toHaveLength(launched.length + 1);
  expect(revised.slice(0, launched.length)).toEqual(launched);
  expect(revised.at(-1)).toMatchObject({ name: "Fix review comments", agent: "fake" });

  const steps = listStepRunsForRun(fix.db, run.id);
  expect(steps.map((step) => step.idx)).toEqual([0, 1]);
  expect(steps.map((step) => step.status)).toEqual(["succeeded", "succeeded"]);
});

it("journals the revision in the run ledger with its origin and frozen agent", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();

  await supervisor.appendStep(run.id, FIX_STEP);
  await supervisor.settle();

  const events = readRunEvents(fix.db, run.id);
  const revisions = events.filter((event) => event.type === "run.plan_revised");
  expect(revisions).toHaveLength(1);
  expect(revisions[0]?.payload).toMatchObject({
    origin: "review_fix",
    step_name: "Fix review comments",
    runtime: "fake",
    depends_on: [],
  });
  expect(revisions[0]?.step_run_id).toBe(getRun(fix.db, run.id)?.plan_json.steps.at(-1)?.id);
});

it("waits for the steps that produced the diff before running the appended one", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const produced = getRun(fix.db, run.id)?.plan_json.steps.map((step) => step.id) ?? [];

  await supervisor.appendStep(run.id, { ...FIX_STEP, dependsOn: produced });
  await supervisor.settle();

  expect(spawn.jobs).toHaveLength(2);
  expect(getRun(fix.db, run.id)?.plan_json.steps.at(-1)?.depends_on).toEqual(produced);
});

it("refuses an unknown dependency instead of writing an unschedulable plan", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const before = getRun(fix.db, run.id)?.plan_json.steps ?? [];

  await expect(
    supervisor.appendStep(run.id, { ...FIX_STEP, dependsOn: ["nope"] }),
  ).rejects.toMatchObject({ name: "InvalidRunPlanError" });

  expect(getRun(fix.db, run.id)?.plan_json.steps).toEqual(before);
  expect(listStepRunsForRun(fix.db, run.id)).toHaveLength(before.length);
});

it("extends the cycle of a failed run in its own worktree, without a second one", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, ["fail", "complete"]);
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  expect(getRun(fix.db, run.id)?.status).toBe("failed");

  const appended = await supervisor.appendStep(run.id, FIX_STEP);
  await supervisor.settle();

  expect(appended.branch).toBe(run.branch);
  expect(spawn.jobs[1]?.worktreePath).toBe(spawn.jobs[0]?.worktreePath);
  expect(fix.db.select().from(schema.worktrees).all()).toHaveLength(1);
});

it("never puts a second writer in the workspace: an appended step waits for the live turn", async () => {
  const { supervisor, spawn } = makeSupervisor(fix, "linger");
  const run = await supervisor.start({ issue_id: "i-work" });
  await waitFor(() => spawn.calls === 1);

  const appended = await supervisor.appendStep(run.id, FIX_STEP);
  const step = appended.plan_json.steps.at(-1);
  if (!step) throw new Error("expected an appended step");

  // The step is durable but unstarted: the post-turn chain owns starting it.
  expect(spawn.calls).toBe(1);
  expect(listStepRunsForRun(fix.db, run.id).find((row) => row.id === step.id)?.status).toBe(
    "queued",
  );

  await supervisor.abort(run.id);
  await supervisor.settle();
});

it("refuses a step once the workspace is released, leaving the plan untouched", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const before = getRun(fix.db, run.id)?.plan_json.steps ?? [];
  // What a merge does: the worktree is released, so the workspace stops being reusable.
  fix.db
    .update(schema.worktrees)
    .set({ status: "removed" })
    .where(eq(schema.worktrees.owner_token, run.id))
    .run();

  await expect(supervisor.appendStep(run.id, FIX_STEP)).rejects.toThrow(RunWorkspaceClosedError);
  expect(getRun(fix.db, run.id)?.plan_json.steps).toEqual(before);
});

it("notifies afterSettle when an appended turn settles live", async () => {
  const outcomes: ReconcileOutcome[] = [];
  const { supervisor } = makeSupervisor(fix, ["complete", "complete"], {
    afterSettle: (outcome) => outcomes.push(outcome),
  });
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  outcomes.length = 0;

  await supervisor.appendStep(run.id, FIX_STEP);
  await supervisor.settle();

  expect(outcomes).toHaveLength(1);
  expect(outcomes[0]).toMatchObject({ runId: run.id, classification: "completed" });
});

it("refuses a step on an issue that closed with its merge", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  updateIssueStatus(fix.db, "i-work", "done");

  await expect(supervisor.appendStep(run.id, FIX_STEP)).rejects.toMatchObject({
    name: "IllegalTransitionError",
    machine: "issue",
  });
  expect(getIssue(fix.db, "i-work")?.status).toBe("done");
  expect(listStepRunsForRun(fix.db, run.id)).toHaveLength(1);
});
