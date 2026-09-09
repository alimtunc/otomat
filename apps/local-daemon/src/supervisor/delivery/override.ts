import { getRun, getStepRun, type StepRunRow } from "@otomat/db";
import { isStepGuardBlocking, stepGuard } from "@otomat/domain";

import { emitLedgerEvent, readRunEvents } from "#events";

import { scheduleNextStep } from "../advance.js";
import { requireRunRow } from "../resume.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { driveRunTo, driveStepTo } from "../transitions.js";
import { buildGuardOverrideEvent } from "./events.js";

export class DeliveryOverrideRefusedError extends Error {
  constructor(
    readonly code: "step_not_found" | "step_not_blocked" | "workspace_busy",
    message: string,
  ) {
    super(message);
    this.name = "DeliveryOverrideRefusedError";
  }
}

export function overrideStepDelivery(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
  note: string,
): StepRunRow {
  const run = getRun(state.db, runId);
  const step = getStepRun(state.db, stepRunId);
  if (!run || !step || step.run_id !== runId) {
    throw new DeliveryOverrideRefusedError(
      "step_not_found",
      `step ${stepRunId} is not on run ${runId}`,
    );
  }
  const guard = stepGuard(readRunEvents(state.db, runId), step.id);
  if (step.status !== "awaiting_human" || guard === null || !isStepGuardBlocking(guard)) {
    throw new DeliveryOverrideRefusedError(
      "step_not_blocked",
      `nothing is being held for a decision on step ${step.name}`,
    );
  }
  if (hasRunActivity(state, runId)) {
    throw new DeliveryOverrideRefusedError(
      "workspace_busy",
      "a turn of this run is still writing in the workspace; wait for it or cancel it first",
    );
  }
  const now = new Date().toISOString();
  driveStepTo(state.db, step.id, step.status, "succeeded");
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildGuardOverrideEvent(
      { runId, stepRunId: step.id, agentSessionId: null },
      step.name,
      note,
      now,
    ),
  );
  // Accepting is the launch: the run has to be working again for the scheduler to converge it.
  driveRunTo(state.db, runId, run.status, "running", now);
  void scheduleNextStep(state, requireRunRow(state.db, runId, "override"));
  const accepted = getStepRun(state.db, step.id);
  if (!accepted) throw new Error(`step ${step.id} vanished immediately after override`);
  return accepted;
}
