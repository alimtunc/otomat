import type { RunPlan, RunPlanStep } from "../contracts/run-plan.js";
import { InvalidRunPlanError } from "./execution-order.js";
import { RUN_PLAN_MAX_STEPS } from "./limits.js";
import { executableSteps } from "./schedule.js";

/**
 * The one legal revision of a launched plan: append a frozen step. Existing
 * nodes are carried over untouched, and the new node may depend only on — or
 * declare that it recovers — nodes that already exist, so the graph stays
 * acyclic by construction and every scheduling and recovery invariant keeps
 * reading the same plan shape.
 */
export function appendPlanStep(plan: RunPlan, step: RunPlanStep): RunPlan {
  const nodeIds = new Set(plan.steps.map((node) => node.id));
  if (nodeIds.has(step.id)) {
    throw new InvalidRunPlanError(`Run plan already holds a node "${step.id}"`);
  }
  for (const dependency of step.depends_on) {
    if (!nodeIds.has(dependency)) {
      throw new InvalidRunPlanError(`Unknown dependency "${dependency}"`);
    }
  }
  const steps = executableSteps(plan);
  if (step.replaces != null && !steps.some((node) => node.id === step.replaces)) {
    throw new InvalidRunPlanError(`Unknown replaced step "${step.replaces}"`);
  }
  if (steps.length >= RUN_PLAN_MAX_STEPS) {
    throw new InvalidRunPlanError(`Run plans support at most ${RUN_PLAN_MAX_STEPS} steps`);
  }
  return { version: 1, steps: [...plan.steps, step] };
}
