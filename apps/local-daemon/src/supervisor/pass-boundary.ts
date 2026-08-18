import {
  getStepRun,
  recordSessionBoundaryError,
  recordSessionPassEnd,
  recordSessionPassStart,
  type Db,
  type SessionBoundaryCapture,
} from "@otomat/db";

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

// A boundary is evidence, never a precondition: an unreadable repository costs the pass its delta, not its turn.
function captureBoundary(
  state: SupervisorState,
  runId: string,
  stepRunId: string | null,
  agentSessionId: string,
): SessionBoundaryCapture | null {
  const service = state.repositories.forRun(runId)?.service ?? null;
  if (service === null) {
    recordSessionBoundaryError(
      state.db,
      agentSessionId,
      "This run has no git repository to capture.",
    );
    return null;
  }
  try {
    return service.captureState(passOwner(state.db, runId, stepRunId));
  } catch (error) {
    recordSessionBoundaryError(state.db, agentSessionId, reason(error));
    return null;
  }
}

/** Taken before the provider is spawned, so Otomat's own setup work sits on the start side, not inside the agent's delta. */
export function capturePassStart(state: SupervisorState, ctx: TurnContext): void {
  const boundary = captureBoundary(state, ctx.runId, ctx.stepRunId, ctx.agentSessionId);
  if (boundary !== null) recordSessionPassStart(state.db, ctx.agentSessionId, boundary);
}

/** Order is the invariant: review stamps addressed comments from `afterSettle`, and their fix proof reads the boundary written here. */
export function finishSettle(state: SupervisorState, outcome: ReconcileOutcome | null): void {
  if (outcome === null) return;
  if (outcome.agentSessionId !== null) {
    const boundary = captureBoundary(
      state,
      outcome.runId,
      outcome.stepRunId,
      outcome.agentSessionId,
    );
    if (boundary !== null) recordSessionPassEnd(state.db, outcome.agentSessionId, boundary);
  }
  if (state.afterSettle === null) return;
  try {
    state.afterSettle(outcome);
  } catch (error) {
    console.error(`[otomat] after-settle hook failed for run ${outcome.runId}`, error);
  }
}
