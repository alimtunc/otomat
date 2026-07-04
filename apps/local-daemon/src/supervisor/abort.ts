import { getRun, listAgentSessionsForRun, listStepRunsForRun } from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { readRunEvents } from "#events";

import { findFinalStatus } from "./evidence.js";
import { buildTerminalMarker } from "./markers.js";
import { terminateGracefully } from "./process.js";
import { drainRunEvents, emitLedgerEvent } from "./run-events.js";
import { settleRun } from "./settle.js";
import type { SupervisorState } from "./state.js";
import { driveRunTo, driveStepsAndSessionsTo } from "./transitions.js";

/** Grace between a graceful `SIGTERM` and a forced `SIGKILL` during abort. */
const ABORT_GRACE_MS = 2000;

export async function abortRun(state: SupervisorState, runId: string): Promise<void> {
  const { db, dataDir } = state;
  const run = getRun(db, runId);
  if (!run || runMachine.isTerminal(run.status)) return;

  state.aborting.add(runId);
  try {
    const handle = state.inflight.get(runId);
    if (handle) await terminateGracefully(handle.proc, ABORT_GRACE_MS);

    const now = new Date().toISOString();
    drainRunEvents(db, dataDir, runId);

    const current = getRun(db, runId);
    if (!current || runMachine.isTerminal(current.status)) return;

    // Worker finished before/during the abort — honor its marker, never overwrite with a fake cancel.
    if (findFinalStatus(readRunEvents(db, runId)) !== null) {
      settleRun(db, dataDir, current, { mode: "live", now });
      return;
    }

    driveRunTo(db, runId, current.status, "canceled", now);
    const sessions = listAgentSessionsForRun(db, runId);
    driveStepsAndSessionsTo(db, listStepRunsForRun(db, runId), sessions, "canceled", "terminated");

    const ref = {
      runId,
      stepRunId: sessions[0]?.step_run_id ?? null,
      agentSessionId: sessions[0]?.id ?? null,
    };
    const providerSessionId =
      sessions.find((s) => s.provider_session_id !== null)?.provider_session_id ?? null;
    const marker = buildTerminalMarker(ref, "canceled", providerSessionId, 0, now);
    emitLedgerEvent(db, dataDir, runId, marker);
  } finally {
    state.aborting.delete(runId);
  }
}
