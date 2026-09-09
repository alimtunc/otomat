import {
  getStepRun,
  listAgentSessionsForRun,
  recordSessionBoundaryError,
  recordSessionPassEnd,
  recordSessionPassStart,
  type Db,
  type SessionBoundaryCapture,
} from "@otomat/db";
import type { AgentSessionKind } from "@otomat/domain";

import type { SupervisorState } from "./state.js";
import type { ReconcileOutcome, TurnContext } from "./types.js";

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A compete candidate works in a worktree of its own; every other step works in the run's canonical one. */
function passOwner(db: Db, runId: string, stepRunId: string | null): string {
  if (stepRunId === null) return runId;
  const competeGroupId = getStepRun(db, stepRunId)?.compete_group_id ?? null;
  return competeGroupId === null ? runId : stepRunId;
}

/** One end of a pass's git boundary, or why it could not be read. */
export interface BoundaryCapture {
  capture: SessionBoundaryCapture | null;
  error: string | null;
}

// A boundary is evidence, never a precondition: an unreadable repository costs the pass its delta, not its turn.
export function captureBoundary(
  state: SupervisorState,
  runId: string,
  stepRunId: string | null,
  agentSessionId: string,
): BoundaryCapture {
  const service = state.repositories.forRun(runId)?.service ?? null;
  if (service === null) {
    const error = "This run has no git repository to capture.";
    recordSessionBoundaryError(state.db, agentSessionId, error);
    return { capture: null, error };
  }
  try {
    return { capture: service.captureState(passOwner(state.db, runId, stepRunId)), error: null };
  } catch (error) {
    const message = reason(error);
    recordSessionBoundaryError(state.db, agentSessionId, message);
    return { capture: null, error: message };
  }
}

/** Taken before the provider is spawned, so Otomat's own setup work sits on the start side, not inside the agent's delta. */
export function capturePassStart(state: SupervisorState, ctx: TurnContext): void {
  const { capture } = captureBoundary(state, ctx.runId, ctx.stepRunId, ctx.agentSessionId);
  if (capture !== null) recordSessionPassStart(state.db, ctx.agentSessionId, capture);
}

function settledSessionKind(
  state: SupervisorState,
  outcome: ReconcileOutcome,
): AgentSessionKind | null {
  if (outcome.agentSessionId === null) return null;
  const sessions = listAgentSessionsForRun(state.db, outcome.runId);
  return sessions.find((session) => session.id === outcome.agentSessionId)?.kind ?? null;
}

/** Order is the invariant: review stamps addressed comments from `afterSettle`, and their fix proof reads the boundary written here. */
export function finishSettle(state: SupervisorState, outcome: ReconcileOutcome | null): void {
  if (outcome === null) return;
  if (outcome.agentSessionId !== null) {
    const { capture } = captureBoundary(
      state,
      outcome.runId,
      outcome.stepRunId,
      outcome.agentSessionId,
    );
    if (capture !== null) recordSessionPassEnd(state.db, outcome.agentSessionId, capture);
  }
  // A supervisor's own turn judges a step; it never addressed a comment, so review must not read it as the step's pass.
  if (state.afterSettle === null || settledSessionKind(state, outcome) === "supervision") return;
  try {
    state.afterSettle(outcome);
  } catch (error) {
    console.error(`[otomat] after-settle hook failed for run ${outcome.runId}`, error);
  }
}
