import { getStepRun, listAgentSessionsForRun, type StepRunRow } from "@otomat/db";

import type { SupervisorState } from "./state.js";

/** A stop the caller got wrong: the step is unknown, or no turn of it is live right now. */
export class StepStopRefusedError extends Error {
  constructor(
    readonly code: "step_not_found" | "step_not_active",
    message: string,
  ) {
    super(message);
    this.name = "StepStopRefusedError";
  }
}

/**
 * Interrupts the step's live turn without grace: no terminal marker lands, so the
 * settle classifies it `interrupted` — resumable on the same provider session and
 * worktree, neither a success nor a failure, starting no dependent step. A worker
 * that already wrote its final marker keeps that ending; the kill only reaps the
 * exiting process. The step's queued messages are held until the operator's next
 * explicit message, retry or resume, so a stopped step never restarts on its own.
 */
export async function stopStepTurn(
  state: SupervisorState,
  runId: string,
  stepRunId: string,
): Promise<StepRunRow> {
  const step = getStepRun(state.db, stepRunId);
  if (!step || step.run_id !== runId) {
    throw new StepStopRefusedError("step_not_found", `step ${stepRunId} is not on run ${runId}`);
  }
  const stepSessionIds = new Set(
    listAgentSessionsForRun(state.db, runId)
      .filter((session) => session.step_run_id === stepRunId)
      .map((session) => session.id),
  );
  const handle = [...state.inflight.values()].find((entry) =>
    stepSessionIds.has(entry.turn.agentSessionId),
  );
  if (!handle) {
    throw new StepStopRefusedError("step_not_active", `step ${stepRunId} has no live turn to stop`);
  }
  state.stopHeld.add(stepRunId);
  handle.proc.kill("SIGKILL");
  await handle.monitor;
  const settled = getStepRun(state.db, stepRunId);
  if (!settled) {
    throw new StepStopRefusedError("step_not_found", `step ${stepRunId} vanished while stopping`);
  }
  if (settled.status !== "awaiting_human") state.stopHeld.delete(stepRunId);
  return settled;
}
