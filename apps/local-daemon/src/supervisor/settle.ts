import {
  listAgentSessionsForRun,
  listStepRunsForRun,
  recordAgentSessionExit,
  updateAgentSessionProvider,
  type AgentSessionRow,
  type Db,
  type RunRow,
  type StepRunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  allStepsSucceeded,
  isStepHalted,
  nextReadyStep,
  runMachine,
  stepRunMachine,
  type RunPlan,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

import { drainRunEvents, emitLedgerEvent, readRunEvents, runDir } from "#events";

import { classify, describe, TARGETS } from "./classify.js";
import { eventsForSession, findFinalStatus, findProviderSessionId } from "./evidence.js";
import { isReapableWorker } from "./identity.js";
import { buildReconciledEvent, type SessionRef } from "./markers.js";
import { isProcessAlive, killProcessGroup } from "./process.js";
import { driveIdleRunTo, driveRunConvergence, driveTurnConvergence } from "./transitions.js";
import { type ProcessExit, type ReconcileClassification, type ReconcileOutcome } from "./types.js";

export interface SettleOptions {
  /** `boot` also emits a `system.reconciled` event and probes/reaps orphan session pids. */
  mode: "live" | "boot";
  /** Exit observed live by the parent; recorded as the session's exit accounting. */
  observedExit?: ProcessExit;
  /** The live-tracked turn; a follow-up runs on an already-terminal step/session so it cannot be derived from rows — boot omits it. */
  turn?: { agentSessionId: string };
  now: string;
}

/** Boot reconciliation may settle a run whose `plan_json` failed to parse; it then converges from whole-ledger evidence. */
type SettleableRun = Pick<RunRow, "id" | "status"> & { plan_json?: RunPlan };

/** The turn being settled: the one session the single-flight supervisor still has open. */
function findActiveSession(sessions: readonly AgentSessionRow[]): AgentSessionRow | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    if (session && !agentSessionMachine.isTerminal(session.status)) return session;
  }
  return null;
}

export function stepStatuses(steps: readonly StepRunRow[]): Map<string, StepRunState> {
  return new Map(steps.map((step) => [step.id, step.status]));
}

/** The session this settle judges: the explicitly tracked turn's, else the one still open. */
export function resolveTurnSession(
  sessions: readonly AgentSessionRow[],
  turn: { agentSessionId: string } | null | undefined,
): AgentSessionRow | null {
  if (turn) return sessions.find((session) => session.id === turn.agentSessionId) ?? null;
  return findActiveSession(sessions);
}

interface RunResolution {
  run: RunState;
  cancelRemaining: boolean;
}

/** A completed step with more work chains live but rests at `awaiting_human` on boot (no auto-run after restart); failure/cancel are fail-fast. */
function resolveRunTarget(
  classification: ReconcileClassification,
  plan: RunPlan,
  projected: Map<string, StepRunState>,
  mode: SettleOptions["mode"],
): RunResolution {
  if (classification === "completed") {
    if (allStepsSucceeded(plan, projected)) return { run: "review_ready", cancelRemaining: false };
    if (nextReadyStep(plan, projected) !== null) {
      return { run: mode === "live" ? "running" : "awaiting_human", cancelRemaining: false };
    }
    return { run: "failed", cancelRemaining: true };
  }
  if (classification === "interrupted") return { run: "awaiting_human", cancelRemaining: false };
  if (classification === "canceled") return { run: "canceled", cancelRemaining: true };
  return { run: "failed", cancelRemaining: true };
}

/** Shared by the live exit path, abort, and boot reconciliation; a no-op on an already-terminal run, so re-running is safe. */
export function settleRun(
  db: Db,
  dataDir: string,
  run: SettleableRun,
  options: SettleOptions,
): ReconcileOutcome | null {
  if (runMachine.isTerminal(run.status)) return null;

  drainRunEvents(db, dataDir, run.id);

  const events = readRunEvents(db, run.id);
  const sessions = listAgentSessionsForRun(db, run.id);
  const steps = listStepRunsForRun(db, run.id);
  const plan = run.plan_json ?? null;

  const turnSession = resolveTurnSession(sessions, options.turn);
  if (options.observedExit && turnSession !== null && turnSession.pid !== null) {
    recordAgentSessionExit(db, turnSession.id, {
      exit_code: options.observedExit.code,
      exit_signal: options.observedExit.signal,
    });
  }

  const orphanTerminated = reapProcesses(db, runDir(dataDir, run.id), sessions, options);

  if (plan !== null && turnSession === null) {
    return settleIdleRun(db, dataDir, run, plan, steps, options, orphanTerminated);
  }

  // A multi-step ledger holds one terminal marker per turn — only this session's slice is evidence for this settle.
  const scoped = turnSession === null ? events : eventsForSession(events, turnSession.id);
  const finalStatus = findFinalStatus(scoped);
  const providerSessionId = findProviderSessionId(scoped);

  const classification = classify(finalStatus, providerSessionId);
  const reason = describe(classification, providerSessionId, orphanTerminated);
  const targets = TARGETS[classification];

  if (
    providerSessionId !== null &&
    turnSession !== null &&
    turnSession.provider_session_id === null
  ) {
    updateAgentSessionProvider(db, turnSession.id, providerSessionId);
  }

  if (plan === null || turnSession === null) {
    // Corrupt plan_json: no per-step truth to schedule from — converge everything.
    driveRunConvergence(db, run, steps, sessions, targets, options.now);
    emitReconciled(db, dataDir, run.id, options, {
      ref: {
        runId: run.id,
        stepRunId: steps[0]?.id ?? null,
        agentSessionId: sessions[0]?.id ?? null,
      },
      classification,
      reason,
      providerSessionId,
      orphanTerminated,
    });
    return { runId: run.id, classification, reason, orphanTerminated, providerSessionId };
  }

  const turnStep = steps.find((step) => step.id === turnSession.step_run_id) ?? null;
  const projected = stepStatuses(steps);
  if (turnStep !== null && !stepRunMachine.isTerminal(turnStep.status)) {
    projected.set(turnStep.id, targets.step);
  }
  const resolution = resolveRunTarget(classification, plan, projected, options.mode);
  const cancelSteps = resolution.cancelRemaining
    ? steps.filter((step) => step.id !== turnStep?.id)
    : [];

  driveTurnConvergence(
    db,
    run,
    { step: turnStep, session: turnSession },
    { ...targets, run: resolution.run },
    cancelSteps,
    options.now,
  );

  emitReconciled(db, dataDir, run.id, options, {
    ref: { runId: run.id, stepRunId: turnStep?.id ?? null, agentSessionId: turnSession.id },
    classification,
    reason,
    providerSessionId,
    orphanTerminated,
  });
  return { runId: run.id, classification, reason, orphanTerminated, providerSessionId };
}

/** No open session (daemon died between steps): progression rebuilds from step rows — finished steps never replay, a startable plan rests at `awaiting_human`. */
function settleIdleRun(
  db: Db,
  dataDir: string,
  run: SettleableRun,
  plan: RunPlan,
  steps: readonly StepRunRow[],
  options: SettleOptions,
  orphanTerminated: boolean,
): ReconcileOutcome {
  const statuses = stepStatuses(steps);
  let classification: ReconcileClassification;
  let target: RunState;
  let cancelRemaining = false;
  let reason: string;

  if (allStepsSucceeded(plan, statuses)) {
    classification = "completed";
    target = "review_ready";
    reason = "every plan step already succeeded";
  } else if (steps.some((step) => isStepHalted(step.status))) {
    const failed = steps.some((step) => step.status === "failed" || step.status === "stale");
    classification = failed ? "failed" : "canceled";
    target = failed ? "failed" : "canceled";
    cancelRemaining = true;
    reason = "a plan step already halted; blocked steps canceled";
  } else if (nextReadyStep(plan, statuses) !== null) {
    classification = "interrupted";
    target = "awaiting_human";
    reason = "stopped between steps; resume starts the next ready step";
  } else {
    classification = "failed";
    target = "failed";
    cancelRemaining = true;
    reason = "no step can start and the plan is not finished";
  }

  driveIdleRunTo(db, run, target, cancelRemaining ? steps : [], options.now);

  emitReconciled(db, dataDir, run.id, options, {
    ref: { runId: run.id, stepRunId: null, agentSessionId: null },
    classification,
    reason,
    providerSessionId: null,
    orphanTerminated,
  });
  return { runId: run.id, classification, reason, orphanTerminated, providerSessionId: null };
}

interface ReconciledAudit {
  ref: SessionRef;
  classification: ReconcileClassification;
  reason: string;
  providerSessionId: string | null;
  orphanTerminated: boolean;
}

function emitReconciled(
  db: Db,
  dataDir: string,
  runId: string,
  options: SettleOptions,
  audit: ReconciledAudit,
): void {
  if (options.mode !== "boot") return;
  const event = buildReconciledEvent(
    audit.ref,
    audit.classification,
    audit.reason,
    audit.providerSessionId,
    audit.orphanTerminated,
    options.now,
  );
  emitLedgerEvent(db, dataDir, runId, event);
}

function reapProcesses(
  db: Db,
  runDirPath: string,
  sessions: readonly AgentSessionRow[],
  options: SettleOptions,
): boolean {
  let orphanTerminated = false;
  for (const session of sessions) {
    if (options.mode !== "boot" || session.pid === null || session.pid <= 1) continue;
    if (agentSessionMachine.isTerminal(session.status)) continue;
    if (!isProcessAlive(session.pid)) continue;
    // The pid is alive — but after a long downtime the OS may have reused it. Only signal when the
    // process identity still proves it is our worker; otherwise leave it and settle from the ledger.
    if (isReapableWorker(runDirPath, session.pid)) {
      killProcessGroup(session.pgid ?? session.pid, "SIGKILL");
      recordAgentSessionExit(db, session.id, { exit_code: null, exit_signal: "SIGKILL" });
      orphanTerminated = true;
    } else {
      console.error(
        `[otomat] session ${session.id}: pid ${session.pid} is alive but its identity is unproven ` +
          `(possible pid reuse); not signalling — settling from ledger evidence`,
      );
    }
  }
  return orphanTerminated;
}
