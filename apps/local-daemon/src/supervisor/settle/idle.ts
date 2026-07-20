import {
  allStepsSucceeded,
  isStepHalted,
  readyPlanWork,
  type RunPlan,
  type RunState,
} from "@otomat/domain";

import { driveIdleRunTo } from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import { competeGroupStatuses, stepStatuses, type SettleContext } from "./context.js";
import { recordReconciled } from "./ledger.js";

/** No open session (daemon died between steps): progression rebuilds from step rows — finished steps never replay, a startable plan rests at `awaiting_human`. */
export function settleIdleRun(ctx: SettleContext, plan: RunPlan): ReconcileOutcome {
  const statuses = stepStatuses(ctx.steps);
  const groups = competeGroupStatuses(ctx.groups);
  let classification: ReconcileClassification;
  let target: RunState;
  let cancelRemaining = false;
  let reason: string;

  if (allStepsSucceeded(plan, statuses, groups)) {
    classification = "completed";
    target = "review_ready";
    reason = "every plan step already succeeded";
  } else if ([...groups.values()].includes("awaiting_selection")) {
    classification = "completed";
    target = "awaiting_selection";
    reason = "competitors finished; an explicit winner is required";
  } else if (
    ctx.steps.some((step) => isStepHalted(step.status) && step.compete_group_id === null) ||
    [...groups.values()].some((status) => status === "failed" || status === "canceled")
  ) {
    const failed = ctx.steps.some((step) => step.status === "failed" || step.status === "stale");
    classification = failed ? "failed" : "canceled";
    target = failed ? "failed" : "canceled";
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

  driveIdleRunTo(ctx.db, ctx.run, target, cancelRemaining ? ctx.steps : [], ctx.options.now);

  return recordReconciled(ctx, {
    ref: { runId: ctx.run.id, stepRunId: null, agentSessionId: null },
    classification,
    reason,
    providerSessionId: null,
    orphanTerminated: ctx.orphanTerminated,
  });
}
