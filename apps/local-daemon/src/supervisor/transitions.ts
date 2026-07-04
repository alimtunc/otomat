import {
  updateAgentSessionStatus,
  updateRunStatus,
  updateStepRunStatus,
  type AgentSessionRow,
  type Db,
  type StepRunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  IllegalTransitionError,
  isRunTerminal,
  runMachine,
  shortestPath,
  stepRunMachine,
  type AgentSessionState,
  type RunState,
  type StateMachine,
  type StepRunState,
} from "@otomat/domain";

function drive<S extends string>(
  machine: StateMachine<S>,
  from: S,
  to: S,
  apply: (state: S) => void,
): void {
  const path = shortestPath(machine, from, to);
  if (path === null) throw new IllegalTransitionError(machine.name, from, to);
  for (const state of path) apply(state);
}

/** Walks the run to `to` along the shortest legal path, stamping `completed_at` on a terminal landing. */
export function driveRunTo(db: Db, runId: string, from: RunState, to: RunState, now: string): void {
  drive(runMachine, from, to, (state) => {
    const completedAt = isRunTerminal(state) ? { completed_at: now } : {};
    updateRunStatus(db, runId, { status: state, ...completedAt });
  });
}

export function driveStepTo(db: Db, stepRunId: string, from: StepRunState, to: StepRunState): void {
  drive(stepRunMachine, from, to, (state) => updateStepRunStatus(db, stepRunId, state));
}

export function driveSessionTo(
  db: Db,
  sessionId: string,
  from: AgentSessionState,
  to: AgentSessionState,
): void {
  drive(agentSessionMachine, from, to, (state) => updateAgentSessionStatus(db, sessionId, state));
}

/** Drives every non-terminal step and session of a run to the given targets. */
export function driveStepsAndSessionsTo(
  db: Db,
  steps: readonly StepRunRow[],
  sessions: readonly AgentSessionRow[],
  stepTarget: StepRunState,
  sessionTarget: AgentSessionState,
): void {
  for (const step of steps) {
    if (!stepRunMachine.isTerminal(step.status)) driveStepTo(db, step.id, step.status, stepTarget);
  }
  for (const session of sessions) {
    if (!agentSessionMachine.isTerminal(session.status))
      driveSessionTo(db, session.id, session.status, sessionTarget);
  }
}
