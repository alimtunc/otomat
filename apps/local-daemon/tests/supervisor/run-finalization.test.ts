import { getRun, listStepRunsForRun } from "@otomat/db";
import type { CompeteGroupState, RunPlan, StepRunState } from "@otomat/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readActivity } from "#api/activity";
import { resolveIdleRun } from "#supervisor/settle/idle";

import { setupDaemonDb, type DaemonTestDb } from "../support/daemon-db.js";
import { runLandings } from "../support/ledger.js";
import { seedWorkflowRun } from "../support/seed.js";
import { makeSupervisor } from "../support/supervisor.js";

let fix: DaemonTestDb;

beforeEach(() => {
  fix = setupDaemonDb();
});

afterEach(() => {
  fix.cleanup();
});

const SEQUENTIAL: RunPlan = {
  version: 1,
  steps: [
    { id: "implement", name: "Implement", agent: "fake", prompt: "build", depends_on: [] },
    { id: "verify", name: "Verify", agent: "fake", prompt: "check", depends_on: ["implement"] },
  ],
};

const RECOVERED: RunPlan = {
  version: 1,
  steps: [
    { id: "implement", name: "Implement", agent: "fake", prompt: "build", depends_on: [] },
    {
      id: "retry",
      name: "Retry",
      agent: "fake",
      prompt: "build again",
      depends_on: [],
      replaces: "implement",
    },
  ],
};

const COMPETING: RunPlan = {
  version: 1,
  steps: [
    {
      id: "approach",
      name: "Choose an approach",
      depends_on: [],
      compete: [
        { id: "direct", name: "Direct", agent: "fake", prompt: "direct" },
        { id: "layered", name: "Layered", agent: "fake", prompt: "layered" },
      ],
    },
  ],
};

function statuses(entries: Record<string, StepRunState>) {
  return new Map(Object.entries(entries));
}

function groups(entries: Record<string, CompeteGroupState> = {}) {
  return new Map(Object.entries(entries));
}

describe("resolveIdleRun", () => {
  it("rests a fully succeeded plan on review_ready", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "succeeded", verify: "succeeded" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "review_ready", cancelRemaining: false });
  });

  it("fails a plan whose required step halted, canceling what can no longer start", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "failed", verify: "queued" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "failed", cancelRemaining: true });
  });

  it("fails a plan whose required step went stale with no recovery", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "stale", verify: "queued" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "failed", cancelRemaining: true });
  });

  it("cancels a plan whose only halted steps were canceled", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "canceled", verify: "canceled" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "canceled", cancelRemaining: true });
  });

  it("keeps a step waiting on its provider quota out of a terminal landing", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "waiting_for_provider", verify: "queued" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "waiting_for_provider", cancelRemaining: false });
  });

  it("rests a stopped step on awaiting_human rather than finalizing the run", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "awaiting_human", verify: "queued" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "awaiting_human", cancelRemaining: false });
  });

  it("reads a halted step through the recovery that replaced it", () => {
    expect(
      resolveIdleRun(RECOVERED, statuses({ implement: "stale", retry: "succeeded" }), groups()),
    ).toMatchObject({ target: "review_ready" });
    expect(
      resolveIdleRun(RECOVERED, statuses({ implement: "stale", retry: "queued" }), groups()),
    ).toMatchObject({ target: "awaiting_human" });
  });

  it("waits for an explicit winner while a competition owes one", () => {
    const resolution = resolveIdleRun(
      COMPETING,
      statuses({ direct: "succeeded", layered: "succeeded" }),
      groups({ approach: "awaiting_selection" }),
    );
    expect(resolution).toMatchObject({ target: "awaiting_selection", cancelRemaining: false });
  });

  it("fails a run whose step is blocked on a permission no live turn can still answer", () => {
    const resolution = resolveIdleRun(
      SEQUENTIAL,
      statuses({ implement: "awaiting_permission", verify: "queued" }),
      groups(),
    );
    expect(resolution).toMatchObject({ target: "failed", cancelRemaining: true });
  });
});

describe("boot convergence", () => {
  it("repairs a run left running once every step is already terminal", () => {
    const { supervisor } = makeSupervisor(fix, "complete");
    seedWorkflowRun(fix.db, {
      runId: "stuck",
      runStatus: "running",
      steps: [
        { id: "implement", status: "succeeded" },
        { id: "verify", status: "succeeded" },
      ],
    });

    const report = supervisor.reconcile();

    expect(report.reconciled).toHaveLength(1);
    const repaired = getRun(fix.db, "stuck");
    expect(repaired?.status).toBe("review_ready");
    expect(runLandings(fix.db, "stuck")).toEqual([
      expect.objectContaining({ status: "review_ready" }),
    ]);
    // The snapshot a reconnecting stream re-reads is cursorless, so it answers with the repaired state.
    expect(readActivity(fix.db).activities).toContainEqual(
      expect.objectContaining({ run_id: "stuck", status: "review_ready", bucket: "attention" }),
    );
  });

  it("stays idempotent: a second pass neither moves the run nor journals a second landing", () => {
    const { supervisor } = makeSupervisor(fix, "complete");
    seedWorkflowRun(fix.db, {
      runId: "stuck",
      runStatus: "running",
      steps: [
        { id: "implement", status: "failed" },
        { id: "verify", status: "queued" },
      ],
    });

    supervisor.reconcile();
    const first = getRun(fix.db, "stuck");
    const second = supervisor.reconcile();

    expect(first?.status).toBe("failed");
    expect(second.reconciled).toHaveLength(0);
    expect(getRun(fix.db, "stuck")).toMatchObject({
      status: "failed",
      completed_at: first?.completed_at,
    });
    expect(listStepRunsForRun(fix.db, "stuck").map((step) => step.status)).toEqual([
      "failed",
      "canceled",
    ]);
    expect(runLandings(fix.db, "stuck")).toHaveLength(1);
  });
});
