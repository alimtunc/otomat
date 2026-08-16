import { getRun, listStepRunsForRun, schema } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events";
import type { AppendStepInput, Supervisor } from "#supervisor";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { seedWorkflowRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
  fix.db
    .insert(schema.issues)
    .values({ id: "i-work", project_id: "p1", title: "Recover me", status: "ready" })
    .run();
});

afterEach(() => {
  fix.cleanup();
});

const RECOVERY_STEP: AppendStepInput = {
  name: "Review again",
  note: null,
  references: [],
  selector: { kind: "runtime", runtimeId: "fake" },
  overrides: {},
  dependsOn: [],
  replaces: null,
  origin: "user",
};

function stepStatus(runId: string, stepId: string): string | undefined {
  return listStepRunsForRun(fix.db, runId).find((step) => step.id === stepId)?.status;
}

/** The run's own canonical status as the ledger tells it, which a turn's terminal marker never speaks for. */
function landedStatus(runId: string): unknown {
  return readRunEvents(fix.db, runId)
    .filter((event) => event.payload["phase"] === "settled")
    .at(-1)?.payload["run_status"];
}

it("leaves failed when the stale step itself is retried and succeeds", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "r-retry",
    issueId: "i-work",
    runStatus: "failed",
    steps: [
      {
        id: "implement",
        status: "stale",
        session: { status: "failed", providerSessionId: "ps-1" },
      },
      { id: "verify", status: "canceled", dependsOn: ["implement"] },
    ],
  });

  await supervisor.resume("r-retry");
  await supervisor.settle();

  expect(getRun(fix.db, "r-retry")?.status).toBe("review_ready");
  expect(stepStatus("r-retry", "implement")).toBe("succeeded");
  // The cascade cancelled the rest of the plan; an explicit resume owes it back.
  expect(stepStatus("r-retry", "verify")).toBe("succeeded");
  expect(landedStatus("r-retry")).toBe("review_ready");
});

it("keeps the failure in the history and says which step the recovery reopened", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "r-history",
    issueId: "i-work",
    runStatus: "failed",
    steps: [
      {
        id: "implement",
        status: "stale",
        session: { status: "failed", providerSessionId: "ps-1" },
      },
    ],
  });

  await supervisor.resume("r-history");
  await supervisor.settle();

  const lifecycle = readRunEvents(fix.db, "r-history").filter(
    (event) => event.type === "run.lifecycle",
  );
  expect(lifecycle.map((event) => event.payload["phase"])).toContain("reopened");
  expect(lifecycle.find((event) => event.payload["phase"] === "reopened")?.payload).toMatchObject({
    from_status: "failed",
    step_name: "Step implement",
  });
});

/** A real launched run whose only step the provider failed: the quota/provider-error shape, worktree and all. */
async function launchFailedRun(supervisor: Supervisor): Promise<{ runId: string; stepId: string }> {
  const run = await supervisor.start({ issue_id: "i-work" });
  await supervisor.settle();
  const stepId = listStepRunsForRun(fix.db, run.id)[0]?.id;
  if (stepId === undefined) throw new Error("the launched run has no step");
  expect(getRun(fix.db, run.id)?.status).toBe("failed");
  expect(stepStatus(run.id, stepId)).toBe("stale");
  return { runId: run.id, stepId };
}

it("leaves failed when a linked recovery step succeeds, without erasing the stale step", async () => {
  const { supervisor } = makeSupervisor(fix, ["fail", "complete"]);
  const { runId, stepId } = await launchFailedRun(supervisor);

  await supervisor.appendStep(runId, { ...RECOVERY_STEP, replaces: stepId });
  await supervisor.settle();

  expect(getRun(fix.db, runId)?.status).toBe("review_ready");
  expect(stepStatus(runId, stepId)).toBe("stale");
  expect(landedStatus(runId)).toBe("review_ready");
});

it("keeps a required failure standing under an unlinked step that merely succeeded", async () => {
  const { supervisor } = makeSupervisor(fix, ["fail", "complete"]);
  const { runId } = await launchFailedRun(supervisor);

  await supervisor.appendStep(runId, RECOVERY_STEP);
  await supervisor.settle();

  expect(getRun(fix.db, runId)?.status).toBe("failed");
  // The appended turn finished, and its own marker says so — but it never speaks for the run.
  expect(
    readRunEvents(fix.db, runId).some((event) => event.payload["final_status"] === "completed"),
  ).toBe(true);
  expect(landedStatus(runId)).toBe("failed");
});

it("reconciles a recovered plan on boot exactly as the live settle did", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "r-boot",
    issueId: "i-work",
    runStatus: "running",
    steps: [
      { id: "implement", status: "succeeded" },
      { id: "reviewer", status: "stale" },
      { id: "review-again", status: "succeeded", replaces: "reviewer" },
    ],
  });

  supervisor.reconcile();

  expect(getRun(fix.db, "r-boot")?.status).toBe("review_ready");
  expect(landedStatus("r-boot")).toBe("review_ready");
});

it("reconciles an unrecovered plan on boot as failed, not as finished", async () => {
  const { supervisor } = makeSupervisor(fix, "complete");
  seedWorkflowRun(fix.db, {
    runId: "r-boot-failed",
    issueId: "i-work",
    runStatus: "running",
    steps: [
      { id: "implement", status: "succeeded" },
      { id: "reviewer", status: "stale" },
      { id: "unrelated", status: "succeeded" },
    ],
  });

  supervisor.reconcile();

  expect(getRun(fix.db, "r-boot-failed")?.status).toBe("failed");
  expect(landedStatus("r-boot-failed")).toBe("failed");
});
