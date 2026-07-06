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
  drivePath,
  isRunTerminal,
  runMachine,
  stepRunMachine,
  type AgentSessionState,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

/** Walks the run to `to` along the shortest legal path, stamping `completed_at` on a terminal landing. */
export function driveRunTo(db: Db, runId: string, from: RunState, to: RunState, now: string): void {
  drivePath(runMachine, from, to, (state) => {
    const completedAt = isRunTerminal(state) ? { completed_at: now } : {};
    updateRunStatus(db, runId, { status: state, ...completedAt });
  });
}

export function driveStepTo(db: Db, stepRunId: string, from: StepRunState, to: StepRunState): void {
  drivePath(stepRunMachine, from, to, (state) => updateStepRunStatus(db, stepRunId, state));
}

export function driveSessionTo(
  db: Db,
  sessionId: string,
  from: AgentSessionState,
  to: AgentSessionState,
): void {
  drivePath(agentSessionMachine, from, to, (state) =>
    updateAgentSessionStatus(db, sessionId, state),
  );
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
