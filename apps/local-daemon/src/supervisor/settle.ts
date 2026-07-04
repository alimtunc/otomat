import {
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionExit,
  updateAgentSessionProvider,
  type AgentSessionRow,
  type Db,
  type RunRow,
} from "@otomat/db";
import { agentSessionMachine, runMachine } from "@otomat/domain";

import { readRunEvents } from "#events";

import { classify, describe, TARGETS } from "./classify.js";
import { findFinalStatus, findProviderSessionId } from "./evidence.js";
import { buildReconciledEvent } from "./markers.js";
import { isProcessAlive, killProcessGroup } from "./process.js";
import { drainRunEvents, emitLedgerEvent } from "./run-events.js";
import { driveRunTo, driveStepsAndSessionsTo } from "./transitions.js";
import { type ProcessExit, type ReconcileOutcome } from "./types.js";

export interface SettleOptions {
  /** `boot` also emits a `system.reconciled` event and probes/reaps orphan session pids. */
  mode: "live" | "boot";
  /** Exit observed live by the parent; recorded as the session's exit accounting. */
  observedExit?: ProcessExit;
  now: string;
}

/** Shared by the live exit path, abort, and boot reconciliation; a no-op on an already-terminal run, so re-running is safe. */
export function settleRun(
  db: Db,
  dataDir: string,
  run: Pick<RunRow, "id" | "status">,
  options: SettleOptions,
): ReconcileOutcome | null {
  if (runMachine.isTerminal(run.status)) return null;

  drainRunEvents(db, dataDir, run.id);

  const events = readRunEvents(db, run.id);
  const finalStatus = findFinalStatus(events);
  const providerSessionId = findProviderSessionId(events);
  const sessions = listAgentSessionsForRun(db, run.id);
  const steps = listStepRunsForRun(db, run.id);

  const orphanTerminated = reapProcesses(db, sessions, options);

  const classification = classify(finalStatus, providerSessionId);
  const reason = describe(classification, providerSessionId, orphanTerminated);
  const targets = TARGETS[classification];

  if (providerSessionId !== null) {
    for (const session of sessions) {
      if (session.provider_session_id === null) {
        updateAgentSessionProvider(db, session.id, providerSessionId);
      }
    }
  }

  driveRunTo(db, run.id, run.status, targets.run, options.now);
  driveStepsAndSessionsTo(db, steps, sessions, targets.step, targets.session);

  if (options.mode === "boot") {
    const ref = {
      runId: run.id,
      stepRunId: steps[0]?.id ?? null,
      agentSessionId: sessions[0]?.id ?? null,
    };
    const event = buildReconciledEvent(
      ref,
      classification,
      reason,
      providerSessionId,
      orphanTerminated,
      options.now,
    );
    emitLedgerEvent(db, dataDir, run.id, event);
  }

  return { runId: run.id, classification, reason, orphanTerminated, providerSessionId };
}

function reapProcesses(db: Db, sessions: AgentSessionRow[], options: SettleOptions): boolean {
  let orphanTerminated = false;
  for (const session of sessions) {
    if (options.observedExit && session.pid !== null) {
      recordAgentSessionExit(db, session.id, {
        exit_code: options.observedExit.code,
        exit_signal: options.observedExit.signal,
      });
    }
    if (options.mode !== "boot" || session.pid === null || session.pid <= 1) continue;
    if (agentSessionMachine.isTerminal(session.status)) continue;
    if (isProcessAlive(session.pid)) {
      killProcessGroup(session.pgid ?? session.pid, "SIGKILL");
      recordAgentSessionExit(db, session.id, { exit_code: null, exit_signal: "SIGKILL" });
      orphanTerminated = true;
    }
  }
  return orphanTerminated;
}
