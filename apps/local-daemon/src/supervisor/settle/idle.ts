import {
  allStepsSucceeded,
  haltedPlanOutcome,
  readyPlanWork,
  type CompeteGroupState,
  type PlanCompeteGroupStatuses,
  type PlanStepStatuses,
  type RunPlan,
  type RunState,
} from "@otomat/domain";

import { driveIdleRunTo } from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import { competeGroupStatuses, stepStatuses, type SettleContext } from "./context.js";
import { recordReconciled, recordRunLanding } from "./ledger.js";

function isHaltedGroup(status: CompeteGroupState): boolean {
  return status === "failed" || status === "canceled";
}

export interface IdleRunResolution {
  classification: ReconcileClassification;
  target: RunState;
  /** A landing that strands unfinished steps cancels them: they can never start again. */
  cancelRemaining: boolean;
  reason: string;
}

/** The one reading a run with no live turn gets, so a missed live transition and a boot reconciliation land it on the same state. */
export function resolveIdleRun(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groups: PlanCompeteGroupStatuses,
): IdleRunResolution {
  const groupStates = [...groups.values()];
  const stepStates = [...statuses.values()];
  const halted = haltedPlanOutcome(plan, statuses);

  if (allStepsSucceeded(plan, statuses, groups)) {
    return {
      classification: "completed",
      target: "review_ready",
      cancelRemaining: false,
      reason: "every plan step already succeeded",
    };
  }
  if (groupStates.includes("awaiting_selection")) {
    return {
      classification: "completed",
      target: "awaiting_selection",
      cancelRemaining: false,
      reason: "competitors finished; an explicit winner is required",
    };
  }
  if (halted !== null || groupStates.some(isHaltedGroup)) {
    const outcome = halted === "failed" || groupStates.includes("failed") ? "failed" : "canceled";
    return {
      classification: outcome,
      target: outcome,
      cancelRemaining: true,
      reason: "a plan step already halted; blocked steps canceled",
    };
  }
  if (stepStates.includes("waiting_for_provider")) {
    return {
      classification: "provider_limited",
      target: "waiting_for_provider",
      cancelRemaining: false,
      reason: "a step is waiting for its provider quota to reopen",
    };
  }
  if (stepStates.includes("awaiting_human") || readyPlanWork(plan, statuses, groups) !== null) {
    return {
      classification: "interrupted",
      target: "awaiting_human",
      cancelRemaining: false,
      reason: "a step is stopped or unstarted; resume takes the plan from there",
    };
  }
  return {
    classification: "failed",
    target: "failed",
    cancelRemaining: true,
    reason: "no step can start and the plan is not finished",
  };
}

/** No open session (daemon died between steps): progression rebuilds from step rows, so finished steps never replay. */
export function settleIdleRun(ctx: SettleContext, plan: RunPlan): ReconcileOutcome {
  const resolution = resolveIdleRun(
    plan,
    stepStatuses(ctx.steps),
    competeGroupStatuses(ctx.groups),
  );

  const ref = { runId: ctx.run.id, stepRunId: null, agentSessionId: null };
  driveIdleRunTo(
    ctx.db,
    ctx.run,
    resolution.target,
    resolution.cancelRemaining ? ctx.steps : [],
    ctx.options.now,
  );
  recordRunLanding(ctx, ref, resolution.target);

  return recordReconciled(ctx, {
    ref,
    classification: resolution.classification,
    reason: resolution.reason,
    providerSessionId: null,
    orphanTerminated: ctx.orphanTerminated,
  });
}
