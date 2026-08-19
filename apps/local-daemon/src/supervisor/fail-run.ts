import { getRun, listStepRunsForRun } from "@otomat/db";
import { isRunSettled } from "@otomat/domain";

import { emitLedgerEvent } from "#events";

import { buildTerminalMarker } from "./markers.js";
import { finishSettle } from "./pass-boundary.js";
import { emitSupervisorLog } from "./run-log.js";
import { hasRunActivity, type SupervisorState } from "./state.js";
import { driveIdleRunTo } from "./transitions.js";

export function failureReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fails a run that never reached a worker. The launch already answered, so the ledger
 * is the only place the operator can read why; a run that meanwhile went terminal or
 * found activity is left alone rather than overwritten by a late scheduling error.
 */
export function failIdleRun(state: SupervisorState, runId: string, reason: string): void {
  const current = getRun(state.db, runId);
  if (!current || isRunSettled(current.status) || hasRunActivity(state, runId)) return;
  const now = new Date().toISOString();
  emitSupervisorLog(state, runId, "stderr", `[otomat] ${reason}`);
  driveIdleRunTo(state.db, current, "failed", listStepRunsForRun(state.db, runId), now);
  const ref = { runId, stepRunId: null, agentSessionId: null };
  emitLedgerEvent(
    state.db,
    state.dataDir,
    runId,
    buildTerminalMarker(ref, "failed", null, null, 0, now),
  );
  finishSettle(state, {
    runId,
    stepRunId: null,
    agentSessionId: null,
    classification: "failed",
    reason,
    orphanTerminated: false,
    providerSessionId: null,
  });
}
