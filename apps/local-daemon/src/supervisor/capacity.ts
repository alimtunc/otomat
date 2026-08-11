import {
  getRun,
  listCompeteGroupsForRun,
  listStepRunsForRun,
  writeMaxConcurrentSessions,
} from "@otomat/db";
import {
  blockingPlanDependencies,
  runMachine,
  type AgentCapacity,
  type RunQueuePosition,
  type RunWait,
} from "@otomat/domain";

import { competeGroupStatuses, stepStatuses } from "./settle/context.js";
import { hasRunActivity, type SupervisorState } from "./state.js";

export function agentCapacity(state: SupervisorState): AgentCapacity {
  return {
    max_concurrent_sessions: state.slots.limit,
    active_sessions: state.slots.active,
    waiting_sessions: state.slots.waiting,
  };
}

/** The write happens first: a refused write must never leave the process on a limit the database disagrees with. */
export function setAgentCapacity(state: SupervisorState, limit: number): AgentCapacity {
  writeMaxConcurrentSessions(state.db, limit);
  state.slots.resize(limit);
  return agentCapacity(state);
}

/** 1-based place of a run's oldest waiting turn, or null when none of its turns is queued for a slot. */
export function runQueuePosition(state: SupervisorState, runId: string): RunQueuePosition | null {
  const position = [...state.waiting.values()].indexOf(runId);
  if (position === -1) return null;
  return {
    position: position + 1,
    active_sessions: state.slots.active,
    max_concurrent_sessions: state.slots.limit,
  };
}

/** A run with a live turn, or one that has simply stopped, reports null and lets its status speak for itself. */
export function runWait(state: SupervisorState, runId: string): RunWait | null {
  const run = getRun(state.db, runId);
  if (!run || runMachine.isTerminal(run.status)) return null;

  const queued = runQueuePosition(state, runId);
  if (queued !== null) return { kind: "concurrency_limit", ...queued };
  if (hasRunActivity(state, runId)) return null;

  const blockers = blockingPlanDependencies(
    run.plan_json,
    stepStatuses(listStepRunsForRun(state.db, runId)),
    competeGroupStatuses(listCompeteGroupsForRun(state.db, runId)),
  );
  if (blockers.length === 0) return null;
  return { kind: "workflow_dependency", blocked_by: blockers.map((node) => node.name) };
}
