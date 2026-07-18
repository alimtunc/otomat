import {
  allStepsSucceeded,
  isStepHalted,
  nextReadyStep,
  type RunPlan,
  type RunState,
} from "@otomat/domain";

import { driveIdleRunTo } from "../transitions.js";
import type { ReconcileClassification, ReconcileOutcome } from "../types.js";
import { stepStatuses, type SettleContext } from "./context.js";
import { emitReconciled } from "./ledger.js";

/** No open session (daemon died between steps): progression rebuilds from step rows — finished steps never replay, a startable plan rests at `awaiting_human`. */
export function settleIdleRun(ctx: SettleContext, plan: RunPlan): ReconcileOutcome {
  const statuses = stepStatuses(ctx.steps);
  let classification: ReconcileClassification;
  let target: RunState;
  let cancelRemaining = false;
  let reason: string;

  if (allStepsSucceeded(plan, statuses)) {
    classification = "completed";
    target = "review_ready";
    reason = "every plan step already succeeded";
  } else if (ctx.steps.some((step) => isStepHalted(step.status))) {
    const failed = ctx.steps.some((step) => step.status === "failed" || step.status === "stale");
    classification = failed ? "failed" : "canceled";
    target = failed ? "failed" : "canceled";
    cancelRemaining = true;
    reason = "a plan step already halted; blocked steps canceled";
  } else if (nextReadyStep(plan, statuses) !== null) {
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

  emitReconciled(ctx, {
    ref: { runId: ctx.run.id, stepRunId: null, agentSessionId: null },
    classification,
    reason,
    providerSessionId: null,
    orphanTerminated: ctx.orphanTerminated,
  });
  return {
    runId: ctx.run.id,
    classification,
    reason,
    orphanTerminated: ctx.orphanTerminated,
    providerSessionId: null,
  };
}
