import { getRun, listStepRunsForRun, setStepProviderWait, type StepRunRow } from "@otomat/db";
import type { ProviderResumeScheduleError, StepProviderWait } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { buildProviderWaitEvent } from "../markers.js";
import type { SupervisorState } from "../state.js";

/** A schedule change the caller got wrong, carrying the wire code the API returns verbatim. */
export class ProviderResumeRefusedError extends Error {
  constructor(
    readonly code: ProviderResumeScheduleError,
    message: string,
  ) {
    super(message);
    this.name = "ProviderResumeRefusedError";
  }
}

interface WaitingStep {
  step: StepRunRow;
  wait: StepProviderWait;
}

/**
 * Every step the scheduler could still resume: a compete group can have several, and
 * they resume together. The run's own state is part of the filter because the sweep
 * reads the same pair — a step left waiting under a run that moved on to a winner
 * selection is nobody's queue, and scheduling against it would never fire.
 */
function waitingSteps(state: SupervisorState, runId: string): WaitingStep[] {
  if (getRun(state.db, runId)?.status !== "waiting_for_provider") return [];
  return listStepRunsForRun(state.db, runId).flatMap((step) =>
    step.status === "waiting_for_provider" && step.provider_wait_json !== null
      ? [{ step, wait: step.provider_wait_json }]
      : [],
  );
}

export function scheduleProviderResume(
  state: SupervisorState,
  runId: string,
  resumeAt: string | null,
): void {
  const now = new Date().toISOString();
  if (resumeAt !== null && resumeAt <= now) {
    throw new ProviderResumeRefusedError(
      "resume_at_passed",
      "Pick a time in the future — that one has already passed.",
    );
  }
  const waiting = waitingSteps(state, runId);
  if (waiting.length === 0) {
    throw new ProviderResumeRefusedError(
      "run_not_waiting",
      `run ${runId} is not waiting on a provider quota`,
    );
  }
  for (const { step, wait } of waiting) {
    const scheduled: StepProviderWait = { ...wait, resume_at: resumeAt };
    setStepProviderWait(state.db, step.id, scheduled);
    emitLedgerEvent(
      state.db,
      state.dataDir,
      runId,
      buildProviderWaitEvent({ runId, stepRunId: step.id, agentSessionId: null }, scheduled, now),
    );
  }
}
