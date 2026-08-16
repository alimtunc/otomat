import {
  allStepsSucceeded,
  haltedPlanOutcome,
  readyPlanWork,
  type CompeteGroupState,
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

/** No open session (daemon died between steps): progression rebuilds from step rows — finished steps never replay, a startable plan rests at `awaiting_human`. */
export function settleIdleRun(ctx: SettleContext, plan: RunPlan): ReconcileOutcome {
  const statuses = stepStatuses(ctx.steps);
  const groups = competeGroupStatuses(ctx.groups);
  const halted = haltedPlanOutcome(plan, statuses);
  const groupStates = [...groups.values()];
  let classification: ReconcileClassification;
  let target: RunState;
  let cancelRemaining = false;
  let reason: string;

  if (allStepsSucceeded(plan, statuses, groups)) {
    classification = "completed";
    target = "review_ready";
    reason = "every plan step already succeeded";
  } else if (groupStates.includes("awaiting_selection")) {
    classification = "completed";
    target = "awaiting_selection";
    reason = "competitors finished; an explicit winner is required";
  } else if (halted !== null || groupStates.some(isHaltedGroup)) {
    classification = halted === "failed" || groupStates.includes("failed") ? "failed" : "canceled";
    target = classification;
    cancelRemaining = true;
    reason = "a plan step already halted; blocked steps canceled";
  } else if (readyPlanWork(plan, statuses, groups) !== null) {
    classification = "interrupted";
    target = "awaiting_human";
    reason = "stopped between steps; resume starts the next ready step";
  } else {
    classification = "failed";
    target = "failed";
    cancelRemaining = true;
    reason = "no step can start and the plan is not finished";
  }

  const ref = { runId: ctx.run.id, stepRunId: null, agentSessionId: null };
  driveIdleRunTo(ctx.db, ctx.run, target, cancelRemaining ? ctx.steps : [], ctx.options.now);
  recordRunLanding(ctx, ref, target);

  return recordReconciled(ctx, {
    ref,
    classification,
    reason,
    providerSessionId: null,
    orphanTerminated: ctx.orphanTerminated,
  });
}
