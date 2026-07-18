import type { RunPlan, RunPlanStep } from "../contracts/entities.js";
import type { StepRunState } from "../state-machines/step-run.js";

/** Step statuses keyed by plan step id; a step with no row yet is treated as `queued`. */
export type PlanStepStatuses = ReadonlyMap<string, StepRunState>;

const HALTED_STEP_STATES: ReadonlySet<StepRunState> = new Set(["failed", "canceled", "stale"]);
const ACTIVE_STEP_STATES: ReadonlySet<StepRunState> = new Set([
  "starting",
  "running",
  "awaiting_permission",
  "awaiting_human",
]);

export function isStepHalted(status: StepRunState): boolean {
  return HALTED_STEP_STATES.has(status);
}

export function isStepActive(status: StepRunState): boolean {
  return ACTIVE_STEP_STATES.has(status);
}

function statusOf(statuses: PlanStepStatuses, stepId: string): StepRunState {
  return statuses.get(stepId) ?? "queued";
}

export interface TopologicalStepOrder {
  /** Steps in deterministic execution order: dependencies first, ties broken by plan position. */
  readonly order: readonly RunPlanStep[];
  /** Steps that could not be ordered — non-empty exactly when the plan has a dependency cycle. */
  readonly remaining: readonly RunPlanStep[];
}

export function topologicalStepOrder(steps: readonly RunPlanStep[]): TopologicalStepOrder {
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

  const order: RunPlanStep[] = [];
  const placed = new Set<number>();
  while (order.length < steps.length) {
    const readyIndex = steps.findIndex((_, index) => !placed.has(index) && indegree[index] === 0);
    if (readyIndex === -1) break;
    placed.add(readyIndex);
    const step = steps[readyIndex];
    if (step === undefined) break;
    order.push(step);
    for (const dependentIndex of dependents.get(step.id) ?? []) {
      const current = indegree[dependentIndex];
      if (current !== undefined) indegree[dependentIndex] = current - 1;
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
export function planExecutionOrder(plan: RunPlan): readonly RunPlanStep[] {
  const { order, remaining } = topologicalStepOrder(plan.steps);
  if (remaining.length > 0) {
    const ids = remaining.map((step) => step.id).join(", ");
    throw new InvalidRunPlanError(`Run plan has a dependency cycle involving: ${ids}`);
  }
  return order;
}

export function hasActiveStep(plan: RunPlan, statuses: PlanStepStatuses): boolean {
  return plan.steps.some((step) => isStepActive(statusOf(statuses, step.id)));
}

/**
 * First queued step (in execution order) whose dependencies have all succeeded.
 * Ignores whether another step is active — single-flight is the caller's rule.
 */
export function nextReadyStep(plan: RunPlan, statuses: PlanStepStatuses): RunPlanStep | null {
  for (const step of planExecutionOrder(plan)) {
    if (statusOf(statuses, step.id) !== "queued") continue;
    const depsSucceeded = step.depends_on.every((dep) => statusOf(statuses, dep) === "succeeded");
    if (depsSucceeded) return step;
  }
  return null;
}

export function allStepsSucceeded(plan: RunPlan, statuses: PlanStepStatuses): boolean {
  return plan.steps.every((step) => statusOf(statuses, step.id) === "succeeded");
}

export type PlanOutcome = "running" | "succeeded" | "failed" | "canceled";

/**
 * `running` while a step is active or another can still start; otherwise the
 * honest terminal outcome — `failed` wins over `canceled` when both occurred
 * (`stale` counts as failed: the daemon lost the process and refuses to guess).
 */
export function planOutcome(plan: RunPlan, statuses: PlanStepStatuses): PlanOutcome {
  if (allStepsSucceeded(plan, statuses)) return "succeeded";
  if (hasActiveStep(plan, statuses)) return "running";
  if (nextReadyStep(plan, statuses) !== null) return "running";
  const states = plan.steps.map((step) => statusOf(statuses, step.id));
  if (states.some((state) => state === "failed" || state === "stale")) return "failed";
  return "canceled";
}
