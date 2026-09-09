import { getRun, getStepRun, type StepRunRow } from "@otomat/db";
import { isStepGuardBlocking, stepGuard, type RunStepOverrideErrorCode } from "@otomat/domain";

import { emitLedgerEvent, readRunEvents } from "#events";

import { scheduleNextStep } from "../advance.js";
import { hasRunActivity, type SupervisorState } from "../state.js";
import { driveRunTo, driveStepTo } from "../transitions.js";
import { buildGuardOverrideEvent } from "./events.js";

/** An override the caller got wrong: the step is unknown, not held, or its workspace still has a writer. */
export class DeliveryOverrideRefusedError extends Error {
  constructor(
    readonly code: RunStepOverrideErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DeliveryOverrideRefusedError";
  }
}

/**
 * Closes a step the delivery guard is holding, on the operator's explicit say-so. Automation
 * never reaches this, and it is journaled as a decision rather than as a verified delivery.
 */
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
  const accepted = getStepRun(state.db, stepRunId);
  if (!accepted) {
    throw new DeliveryOverrideRefusedError(
      "step_not_found",
      `step ${stepRunId} vanished while accepting it`,
    );
  }
  // Accepting is the launch: the run has to be working again for the scheduler to converge it.
  driveRunTo(state.db, runId, run.status, "running", now);
  void scheduleNextStep(state, getRun(state.db, runId) ?? run);
  return accepted;
}
