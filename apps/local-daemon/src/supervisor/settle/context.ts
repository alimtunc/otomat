import type { AgentSessionRow, Db, RunRow, StepRunRow } from "@otomat/db";
import { agentSessionMachine, type RunPlan, type StepRunState } from "@otomat/domain";

import type { Targets } from "../classify.js";
import type { ProcessExit, ReconcileClassification } from "../types.js";

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
export type SettleableRun = Pick<RunRow, "id" | "status"> & { plan_json?: RunPlan };

/** Everything a settle branch needs, gathered once by `settleRun`. */
export interface SettleContext {
  db: Db;
  dataDir: string;
  run: SettleableRun;
  steps: readonly StepRunRow[];
  sessions: readonly AgentSessionRow[];
  options: SettleOptions;
  orphanTerminated: boolean;
}

/** What the turn's ledger slice proved, resolved once and consumed by every settle branch. */
export interface SettleEvidence {
  classification: ReconcileClassification;
  reason: string;
  providerSessionId: string | null;
  targets: Targets;
}

export function stepStatuses(steps: readonly StepRunRow[]): Map<string, StepRunState> {
  return new Map(steps.map((step) => [step.id, step.status]));
}

/** The turn being settled: the one session the single-flight supervisor still has open. */
function findActiveSession(sessions: readonly AgentSessionRow[]): AgentSessionRow | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    if (session && !agentSessionMachine.isTerminal(session.status)) return session;
  }
  return null;
}

/** The session this settle judges: the explicitly tracked turn's, else the one still open. */
export function resolveTurnSession(
  sessions: readonly AgentSessionRow[],
  turn: { agentSessionId: string } | null | undefined,
): AgentSessionRow | null {
  if (turn) return sessions.find((session) => session.id === turn.agentSessionId) ?? null;
  return findActiveSession(sessions);
}
