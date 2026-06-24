import {
  updateAgentSessionStatus,
  updateRunStatus,
  updateStepRunStatus,
  type Db,
} from "@otomat/db";
import {
  agentSessionMachine,
  isRunTerminal,
  runMachine,
  stepRunMachine,
  type AgentSessionState,
  type RunState,
  type StateMachine,
  type StepRunState,
} from "@otomat/domain";

/**
 * Shortest legal sequence of states from `from` to `to` through `machine`, excluding
 * `from` and including `to`; null when `to` is unreachable. Lets reconciliation aim a
 * crashed entity at a target outcome without hard-coding every intermediate hop (e.g.
 * `awaiting_permission → running → awaiting_human`).
 */
export function shortestPath<S extends string>(
  machine: StateMachine<S>,
  from: S,
  to: S,
): S[] | null {
  if (from === to) return [];
  const queue: S[][] = [[from]];
  const seen = new Set<S>([from]);

  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) break;
    const last = path.at(-1);
    if (last === undefined) continue;

    for (const next of machine.next(last)) {
      if (seen.has(next)) continue;
      const extended = [...path, next];
      if (next === to) return extended.slice(1);
      seen.add(next);
      queue.push(extended);
    }
  }
  return null;
}

/** Walks the run from `from` to `to` along the shortest legal path, stamping `completed_at` on a terminal landing. */
export function driveRunTo(
  db: Db,
  runId: string,
  from: RunState,
  to: RunState,
  now: string,
): RunState {
  const path = shortestPath(runMachine, from, to);
  if (path === null) return from;
  let reached = from;
  for (const state of path) {
    const completedAt = isRunTerminal(state) ? { completed_at: now } : {};
    updateRunStatus(db, runId, { status: state, ...completedAt });
    reached = state;
  }
  return reached;
}

export function driveStepTo(
  db: Db,
  stepRunId: string,
  from: StepRunState,
  to: StepRunState,
): StepRunState {
  const path = shortestPath(stepRunMachine, from, to);
  if (path === null) return from;
  let reached = from;
  for (const state of path) {
    updateStepRunStatus(db, stepRunId, state);
    reached = state;
  }
  return reached;
}

export function driveSessionTo(
  db: Db,
  sessionId: string,
  from: AgentSessionState,
  to: AgentSessionState,
): AgentSessionState {
  const path = shortestPath(agentSessionMachine, from, to);
  if (path === null) return from;
  let reached = from;
  for (const state of path) {
    updateAgentSessionStatus(db, sessionId, state);
    reached = state;
  }
  return reached;
}
