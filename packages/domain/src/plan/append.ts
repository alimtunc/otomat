import {
  isRunPlanCompeteGroup,
  type RunPlan,
  type RunPlanNode,
  type RunPlanStep,
} from "../contracts/run-plan.js";
import { InvalidRunPlanError } from "./execution-order.js";
import { RUN_PLAN_MAX_STEPS } from "./limits.js";
import {
  dependencySucceeded,
  effectiveStepStatuses,
  executableSteps,
  isStepHalted,
  unreachablePlanNodes,
  type PlanCompeteGroupStatuses,
  type PlanStepStatuses,
} from "./schedule.js";

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
  if (step.parallel === true && step.depends_on.length > 0) {
    throw new InvalidRunPlanError("A parallel step waits on nothing; drop its dependencies");
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

function isNodeHalted(
  node: RunPlanNode,
  effective: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): boolean {
  if (isRunPlanCompeteGroup(node)) {
    const status = groupStatuses.get(node.id);
    return status === "failed" || status === "canceled";
  }
  const status = effective.get(node.id);
  return status !== undefined && isStepHalted(status);
}

export interface WaitablePlanNode {
  node: RunPlanNode;
  succeeded: boolean;
}

/** Nodes an appended step may wait on, in plan order — never a halted one or one nothing will start, which would hold it forever; `succeeded` marks those that already released their dependents. */
export function waitablePlanNodes(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): WaitablePlanNode[] {
  const effective = effectiveStepStatuses(plan, statuses);
  const unreachable = unreachablePlanNodes(plan, statuses, groupStatuses);
  return plan.steps
    .filter((node) => !unreachable.has(node.id) && !isNodeHalted(node, effective, groupStatuses))
    .map((node) => ({
      node,
      succeeded: dependencySucceeded(plan, node.id, effective, groupStatuses),
    }));
}
