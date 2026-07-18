import { getRun, listAgentSessionsForRun, listStepRunsForRun, type RunRow } from "@otomat/db";
import { runMachine } from "@otomat/domain";

import { drainRunEvents, emitLedgerEvent, readRunEvents } from "#events";

import { TARGETS } from "./classify.js";
import { eventsForSession, findFinalStatus } from "./evidence.js";
import { buildTerminalMarker } from "./markers.js";
import { terminateGracefully } from "./process.js";
import { findActiveSession, settleRun } from "./settle.js";
import { notifyAfterSettle, type SupervisorState } from "./state.js";
import { driveRunConvergence, driveTurnConvergence } from "./transitions.js";

/** Grace between a graceful `SIGTERM` and a forced `SIGKILL` during abort. */
const ABORT_GRACE_MS = 2000;

/** The user asked to stop: whatever the settled turn produced, nothing further starts. */
function cancelRemainder(state: SupervisorState, run: RunRow, now: string): void {
  if (run.status !== "running") return;
  driveTurnConvergence(
    state.db,
    run,
    { step: null, session: null },
    { run: "canceled", step: "canceled", session: "terminated" },
    listStepRunsForRun(state.db, run.id),
    now,
  );
}

/**
 * Aborts an in-flight run: gracefully terminates its process group (SIGTERM then
 * SIGKILL), then drives it to `canceled` and appends a terminal marker. No-op when the
 * run is missing or already terminal. If the worker wrote its own final marker before
 * the abort landed, that result is honored instead of a forced cancel — and any steps
 * that were still waiting are then canceled, never started.
 */
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

    const sessions = listAgentSessionsForRun(db, runId);
    const turn = handle?.turn ?? null;
    const active = turn
      ? (sessions.find((session) => session.id === turn.agentSessionId) ?? null)
      : findActiveSession(sessions);
    const events = readRunEvents(db, runId);
    const scoped = active === null ? events : eventsForSession(events, active.id);

    // Worker finished before/during the abort — honor its marker, never overwrite with a fake cancel.
    if (findFinalStatus(scoped) !== null) {
      notifyAfterSettle(
        state,
        settleRun(db, dataDir, current, { mode: "live", ...(turn ? { turn } : {}), now }),
      );
      const settled = getRun(db, runId);
      if (settled) cancelRemainder(state, settled, now);
      return;
    }

    driveRunConvergence(
      db,
      current,
      listStepRunsForRun(db, runId),
      sessions,
      TARGETS.canceled,
      now,
    );

    const ref = {
      runId,
      stepRunId: active?.step_run_id ?? sessions[0]?.step_run_id ?? null,
      agentSessionId: active?.id ?? sessions[0]?.id ?? null,
    };
    const providerSessionId =
      active?.provider_session_id ??
      sessions.find((s) => s.provider_session_id !== null)?.provider_session_id ??
      null;
    const marker = buildTerminalMarker(ref, "canceled", providerSessionId, 0, now);
    emitLedgerEvent(db, dataDir, runId, marker);
    notifyAfterSettle(state, {
      runId,
      classification: "canceled",
      reason: "aborted by user",
      orphanTerminated: false,
      providerSessionId,
    });
  } finally {
    state.aborting.delete(runId);
  }
}
