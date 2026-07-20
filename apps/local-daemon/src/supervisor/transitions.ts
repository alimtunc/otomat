import {
  updateAgentSessionStatus,
  updateCompeteGroupStatus,
  updateRunStatus,
  updateStepRunStatus,
  type AgentSessionRow,
  type Db,
  type StepRunRow,
} from "@otomat/db";
import {
  agentSessionMachine,
  competeGroupMachine,
  drivePath,
  isRunTerminal,
  runMachine,
  stepRunMachine,
  type AgentSessionState,
  type CompeteGroupState,
  type RunState,
  type StepRunState,
} from "@otomat/domain";

import type { Targets } from "./classify.js";

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

export function driveCompeteGroupTo(
  db: Db,
  groupId: string,
  from: CompeteGroupState,
  to: CompeteGroupState,
): void {
  drivePath(competeGroupMachine, from, to, (state) => updateCompeteGroupStatus(db, groupId, state));
}

/** Drives every non-terminal step and session of a run to the given targets. */
function driveStepsAndSessionsTo(
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

/** One transaction: the turn's step/session reach their targets, no-longer-startable steps cancel, the run lands on the plan-derived target. */
export function driveTurnConvergence(
  db: Db,
  run: { id: string; status: RunState },
  turn: { step: StepRunRow | null; session: AgentSessionRow | null },
  targets: Targets,
  cancelSteps: readonly StepRunRow[],
  now: string,
): void {
  db.transaction(
    () => {
      if (turn.step && !stepRunMachine.isTerminal(turn.step.status)) {
        driveStepTo(db, turn.step.id, turn.step.status, targets.step);
      }
      if (turn.session && !agentSessionMachine.isTerminal(turn.session.status)) {
        driveSessionTo(db, turn.session.id, turn.session.status, targets.session);
      }
      for (const step of cancelSteps) {
        if (!stepRunMachine.isTerminal(step.status)) {
          driveStepTo(db, step.id, step.status, "canceled");
        }
      }
      driveRunTo(db, run.id, run.status, targets.run, now);
    },
    { behavior: "immediate" },
  );
}

/** Converges a run with no live turn: `cancelSteps` cancel and the run lands on `target`. */
export function driveIdleRunTo(
  db: Db,
  run: { id: string; status: RunState },
  target: RunState,
  cancelSteps: readonly StepRunRow[],
  now: string,
): void {
  driveTurnConvergence(
    db,
    run,
    { step: null, session: null },
    { run: target, step: "canceled", session: "terminated" },
    cancelSteps,
    now,
  );
}

/** Converges a run and its non-terminal steps/sessions onto the target states as one transaction. */
export function driveRunConvergence(
  db: Db,
  run: { id: string; status: RunState },
  steps: readonly StepRunRow[],
  sessions: readonly AgentSessionRow[],
  targets: Targets,
  now: string,
): void {
  db.transaction(
    () => {
      driveRunTo(db, run.id, run.status, targets.run, now);
      driveStepsAndSessionsTo(db, steps, sessions, targets.step, targets.session);
    },
    { behavior: "immediate" },
  );
}
