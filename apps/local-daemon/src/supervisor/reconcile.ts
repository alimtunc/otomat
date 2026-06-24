import { join } from "node:path";

import {
  listActiveRuns,
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionExit,
  updateAgentSessionProvider,
  type AgentSessionRow,
  type Db,
  type RunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  runMachine,
  stepRunMachine,
  type AgentSessionState,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

import { EventTailer, readRunEvents } from "#events";

import {
  buildReconciledEvent,
  emitLedgerEvent,
  findFinalStatus,
  findProviderSessionId,
} from "./marker.js";
import { isProcessAlive, killProcessGroup } from "./process.js";
import { driveRunTo, driveSessionTo, driveStepTo } from "./transitions.js";
import {
  RESTING_RUN_STATES,
  type ProcessExit,
  type ReconcileClassification,
  type ReconcileOutcome,
  type ReconcileReport,
} from "./types.js";

interface Targets {
  run: RunState;
  step: StepRunState;
  session: AgentSessionState;
}

/** Each classification's canonical resting/terminal states across the three machines. */
const TARGETS: Record<ReconcileClassification, Targets> = {
  completed: { run: "review_ready", step: "succeeded", session: "terminated" },
  canceled: { run: "canceled", step: "canceled", session: "terminated" },
  interrupted: { run: "awaiting_human", step: "awaiting_human", session: "awaiting_input" },
  failed: { run: "failed", step: "stale", session: "failed" },
};

function classify(
  finalStatus: "completed" | "failed" | "canceled" | null,
  providerSessionId: string | null,
): ReconcileClassification {
  if (finalStatus !== null) return finalStatus === "completed" ? "completed" : finalStatus;
  if (providerSessionId !== null) return "interrupted";
  return "failed";
}

function describe(
  classification: ReconcileClassification,
  providerSessionId: string | null,
  orphanTerminated: boolean,
): string {
  const orphan = orphanTerminated ? " (orphan process group terminated)" : "";
  if (classification === "completed") return `terminal marker found: run finished${orphan}`;
  if (classification === "canceled") return `abort marker found: run canceled${orphan}`;
  if (classification === "interrupted") {
    return `ledger cut before completion; resumable via provider session ${providerSessionId}${orphan}`;
  }
  return `process dead with no resumable evidence${orphan}`;
}

export interface SettleOptions {
  /** Append a `system.reconciled` event to the run timeline (boot reconciliation only). */
  emitReconciled: boolean;
  /** Probe each session pid and reap a still-alive orphan group (boot reconciliation only). */
  probeLiveness: boolean;
  /** Exit observed live by the parent; recorded as the session's exit accounting. */
  observedExit?: ProcessExit;
  now: string;
}

/**
 * Drains the run's durable `events.jsonl`, classifies it from the terminal marker +
 * provider-session evidence + process liveness, and drives run/step/session to their
 * canonical states through the machines. Shared by the live exit path and boot
 * reconciliation; a no-op on an already-terminal run, so re-running it is safe.
 */
export function settleRun(
  db: Db,
  dataDir: string,
  run: RunRow,
  options: SettleOptions,
): ReconcileOutcome | null {
  const runState = run.status as RunState;
  if (runMachine.isTerminal(runState)) return null;

  const filePath = join(dataDir, "runs", run.id, "events.jsonl");
  try {
    new EventTailer({ db, runId: run.id, filePath }).drain();
  } catch (error) {
    console.error(`[otomat] reconcile drain failed for run ${run.id}`, error);
  }

  const events = readRunEvents(db, run.id);
  const finalStatus = findFinalStatus(events);
  const providerSessionId = findProviderSessionId(events);
  const sessions = listAgentSessionsForRun(db, run.id);
  const steps = listStepRunsForRun(db, run.id);

  const orphanTerminated = reapProcesses(db, sessions, options);

  const classification = classify(finalStatus, providerSessionId);
  const reason = describe(classification, providerSessionId, orphanTerminated);
  const targets = TARGETS[classification];

  driveRunTo(db, run.id, runState, targets.run, options.now);

  for (const step of steps) {
    const state = step.status as StepRunState;
    if (!stepRunMachine.isTerminal(state)) driveStepTo(db, step.id, state, targets.step);
  }

  for (const session of sessions) {
    if (providerSessionId !== null && session.provider_session_id === null) {
      updateAgentSessionProvider(db, session.id, providerSessionId);
    }
    const state = session.status as AgentSessionState;
    if (!agentSessionMachine.isTerminal(state))
      driveSessionTo(db, session.id, state, targets.session);
  }

  if (options.emitReconciled) {
    const ref = {
      runId: run.id,
      stepRunId: steps[0]?.id ?? null,
      agentSessionId: sessions[0]?.id ?? null,
    };
    emitLedgerEvent(
      db,
      dataDir,
      run.id,
      buildReconciledEvent(
        ref,
        classification,
        reason,
        providerSessionId,
        orphanTerminated,
        options.now,
      ),
    );
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
        last_seen: options.now,
      });
    }
    if (!options.probeLiveness || session.pid === null || session.pid <= 1) continue;
    if (agentSessionMachine.isTerminal(session.status as AgentSessionState)) continue;
    if (isProcessAlive(session.pid)) {
      killProcessGroup(session.pgid ?? session.pid, "SIGKILL");
      recordAgentSessionExit(db, session.id, {
        exit_code: null,
        exit_signal: "SIGKILL",
        last_seen: options.now,
      });
      orphanTerminated = true;
    }
  }
  return orphanTerminated;
}

/** Boot pass: settle every in-flight run left non-terminal by a crash or kill. */
export function reconcileRuns(db: Db, dataDir: string, now: string): ReconcileReport {
  const resting: readonly string[] = RESTING_RUN_STATES;
  const runs = listActiveRuns(db).filter((run) => !resting.includes(run.status));
  const reconciled: ReconcileOutcome[] = [];
  for (const run of runs) {
    const outcome = settleRun(db, dataDir, run, { emitReconciled: true, probeLiveness: true, now });
    if (outcome !== null) reconciled.push(outcome);
  }
  return { reconciled };
}
