import {
  isRunPlanCompeteGroup,
  type RunPlan,
  type RunPlanCompeteGroup,
  type RunPlanCompetitor,
  type RunPlanStep,
} from "../contracts/entities/runs.js";
import type { CompeteGroupState } from "../state-machines/compete-group.js";
import type { StepRunState } from "../state-machines/step-run.js";
import { planExecutionOrder } from "./execution-order.js";

/** Step statuses keyed by plan step id; a step with no row yet is treated as `queued`. */
export type PlanStepStatuses = ReadonlyMap<string, StepRunState>;
export type PlanCompeteGroupStatuses = ReadonlyMap<string, CompeteGroupState>;

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

const ACTIVE_COMPETE_GROUP_STATES: ReadonlySet<CompeteGroupState> = new Set([
  "running",
  "awaiting_human",
  "awaiting_selection",
  "promoting",
]);

export function isStepActive(status: StepRunState): boolean {
  return ACTIVE_STEP_STATES.has(status);
}

function statusOf(statuses: PlanStepStatuses, stepId: string): StepRunState {
  return statuses.get(stepId) ?? "queued";
}

export function hasActiveStep(plan: RunPlan, statuses: PlanStepStatuses): boolean {
  return executableSteps(plan).some((step) => isStepActive(statusOf(statuses, step.id)));
}

/** Every node the supervisor can actually spawn, compete groups flattened into their candidates. */
export function executableSteps(plan: RunPlan): Array<RunPlanStep | RunPlanCompetitor> {
  return plan.steps.flatMap((node) => (isRunPlanCompeteGroup(node) ? node.compete : [node]));
}

function dependencySucceeded(
  plan: RunPlan,
  dependencyId: string,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): boolean {
  const dependency = plan.steps.find((node) => node.id === dependencyId);
  if (!dependency) return false;
  return isRunPlanCompeteGroup(dependency)
    ? groupStatuses.get(dependency.id) === "selected"
    : statusOf(statuses, dependency.id) === "succeeded";
}

export type ReadyPlanWork =
  | { kind: "step"; step: RunPlanStep }
  | {
      kind: "compete";
      group: RunPlanCompeteGroup;
      competitors: readonly RunPlanCompetitor[];
    };

/** First ready top-level node; only candidates inside that node may be returned together. */
export function readyPlanWork(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): ReadyPlanWork | null {
  for (const node of planExecutionOrder(plan)) {
    const depsSucceeded = node.depends_on.every((dependency) =>
      dependencySucceeded(plan, dependency, statuses, groupStatuses),
    );
    if (!depsSucceeded) continue;

    if (!isRunPlanCompeteGroup(node)) {
      if (statusOf(statuses, node.id) === "queued") return { kind: "step", step: node };
      continue;
    }

    const groupStatus = groupStatuses.get(node.id) ?? "queued";
    if (groupStatus !== "queued" && groupStatus !== "running") continue;
    const competitors = node.compete.filter(
      (competitor) => statusOf(statuses, competitor.id) === "queued",
    );
    if (competitors.length > 0) return { kind: "compete", group: node, competitors };
  }
  return null;
}

export function allStepsSucceeded(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses = new Map(),
): boolean {
  return plan.steps.every((node) =>
    isRunPlanCompeteGroup(node)
      ? groupStatuses.get(node.id) === "selected"
      : statusOf(statuses, node.id) === "succeeded",
  );
}

export type PlanOutcome = "running" | "succeeded" | "failed" | "canceled";

/** `running` while a step is active or startable; otherwise `failed` wins over `canceled`, and `stale` counts as failed. */
export function planOutcome(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses = new Map(),
): PlanOutcome {
  if (allStepsSucceeded(plan, statuses, groupStatuses)) return "succeeded";
  if (hasActiveStep(plan, statuses)) return "running";
  if (readyPlanWork(plan, statuses, groupStatuses) !== null) return "running";
  const competitionStates = [...groupStatuses.values()];
  if (competitionStates.some((state) => ACTIVE_COMPETE_GROUP_STATES.has(state))) return "running";
  const states = executableSteps(plan).map((step) => statusOf(statuses, step.id));
  if (competitionStates.includes("failed")) return "failed";
  if (states.some((state) => state === "failed" || state === "stale")) return "failed";
  return "canceled";
}
