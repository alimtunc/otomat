import { getRun, listAgentSessionsForRun, listStepRunsForRun, type RunRow } from "@otomat/db";
import { isRunSettled } from "@otomat/domain";

import { drainRunEvents, drainSessionEvents, emitLedgerEvent, readRunEvents } from "#events";

import { TARGETS } from "./classify.js";
import { cancelUndeliverableContributions } from "./contribution/deliver.js";
import { eventsForSession, findFinalStatus } from "./evidence.js";
import { buildTerminalMarker } from "./markers.js";
import { finishSettle } from "./pass-boundary.js";
import { terminateGracefully } from "./process.js";
import { resolveSessionContributions } from "./settle/contributions.js";
import { resolveTurnSession, settleRun, type SettleOptions } from "./settle/index.js";
import { processesForRun, type SupervisorState } from "./state.js";
import { driveIdleRunTo, driveRunConvergence } from "./transitions.js";

/** Grace between a graceful `SIGTERM` and a forced `SIGKILL` during abort. */
const ABORT_GRACE_MS = 2000;

/** The user asked to stop: whatever the settled turn produced, nothing further starts. */
function cancelRemainder(state: SupervisorState, run: RunRow, now: string): void {
  if (run.status !== "running") return;
  driveIdleRunTo(state.db, run, "canceled", listStepRunsForRun(state.db, run.id), now);
}

/** SIGTERM-then-SIGKILL the process group and drive the run to `canceled`; a worker-written final marker is honored over a forced cancel, and waiting steps are canceled, never started. */
export async function abortRun(state: SupervisorState, runId: string): Promise<void> {
  const { db, dataDir } = state;
  const run = getRun(db, runId);
  if (!run || isRunSettled(run.status)) return;

  state.aborting.add(runId);
  try {
    // Interrupt running init commands and unqueue slot waiters first: both resolve through
    // `spawnTurn`'s abandon path, so only live workers need signaling below.
    for (const controller of state.initInterrupts.get(runId) ?? []) controller.abort();
    for (const [sessionId, claimedRunId] of state.claiming) {
      if (claimedRunId === runId) state.slots.cancel(sessionId);
    }
    const handles = processesForRun(state, runId);
    await Promise.all(handles.map((handle) => terminateGracefully(handle.proc, ABORT_GRACE_MS)));

    const now = new Date().toISOString();
    drainRunEvents(db, dataDir, runId);

    const current = getRun(db, runId);
    if (!current || isRunSettled(current.status)) return;

    const sessions = listAgentSessionsForRun(db, runId);
    for (const session of sessions) drainSessionEvents(db, dataDir, runId, session.id);
    const turn = handles.length === 1 ? (handles[0]?.turn ?? null) : null;
    const active = resolveTurnSession(sessions, turn);
    const events = readRunEvents(db, runId);
    const scoped = active === null ? events : eventsForSession(events, active.id);

    if (handles.length <= 1 && findFinalStatus(scoped) !== null) {
      const settle: SettleOptions = { mode: "live", now };
      if (turn) settle.turn = turn;
      finishSettle(state, settleRun(db, dataDir, current, settle));
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
    for (const session of sessions) resolveSessionContributions(db, session.id, "canceled", now);

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
    finishSettle(state, {
      runId,
      stepRunId: ref.stepRunId,
      agentSessionId: ref.agentSessionId,
      classification: "canceled",
      reason: "aborted by user",
      orphanTerminated: false,
      providerSessionId,
    });
  } finally {
    cancelUndeliverableContributions(state, runId);
    state.aborting.delete(runId);
  }
}
