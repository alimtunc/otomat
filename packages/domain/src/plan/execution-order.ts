import type { RunPlan, RunPlanNode } from "../contracts/run-plan.js";

/** Ordering reads ids and edges only, so a launch input orders exactly like a frozen plan. */
interface PlanDependencyNode {
  readonly id: string;
  readonly depends_on: readonly string[];
}

export interface TopologicalStepOrder<T extends PlanDependencyNode> {
  /** Steps in deterministic execution order: dependencies first, ties broken by plan position. */
  readonly order: readonly T[];
  /** Steps that could not be ordered — non-empty exactly when the plan has a dependency cycle. */
  readonly remaining: readonly T[];
}

export function topologicalStepOrder<T extends PlanDependencyNode>(
  steps: readonly T[],
): TopologicalStepOrder<T> {
  const indexById = new Map(steps.map((step, index) => [step.id, index]));
  const indegree = steps.map((step) => step.depends_on.filter((dep) => indexById.has(dep)).length);
  const dependents = new Map<string, number[]>();
  steps.forEach((step, index) => {
    for (const dep of step.depends_on) {
      if (!indexById.has(dep)) continue;
      const entry = dependents.get(dep) ?? [];
      entry.push(index);
      dependents.set(dep, entry);
    }
  });

  const order: T[] = [];
  const placed = new Set<number>();
  while (order.length < steps.length) {
    const readyIndex = steps.findIndex((_, index) => !placed.has(index) && indegree[index] === 0);
    if (readyIndex === -1) break;
    placed.add(readyIndex);
    const step = steps[readyIndex];
    order.push(step);
    for (const dependentIndex of dependents.get(step.id) ?? []) {
      indegree[dependentIndex] -= 1;
    }
  }

  const remaining = steps.filter((_, index) => !placed.has(index));
  return { order, remaining };
}

export class InvalidRunPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRunPlanError";
  }
}

/** Deterministic execution order for a validated plan; throws when the plan holds a cycle. */
export function planExecutionOrder(plan: RunPlan): readonly RunPlanNode[] {
  const { order, remaining } = topologicalStepOrder(plan.steps);
  if (remaining.length > 0) {
    const ids = remaining.map((step) => step.id).join(", ");
    throw new InvalidRunPlanError(`Run plan has a dependency cycle involving: ${ids}`);
  }
  return order;
}
