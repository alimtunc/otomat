import {
  isRunPlanCompeteGroup,
  type RunPlan,
  type RunPlanCompeteGroup,
  type RunPlanCompetitor,
  type RunPlanNode,
  type RunPlanStep,
} from "../contracts/run-plan.js";
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
  "waiting_for_provider",
]);

function isStepHalted(status: StepRunState): boolean {
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

/** The plan node one launched step run came from. */
export function planStepFor(
  plan: RunPlan,
  stepRunId: string,
): RunPlanStep | RunPlanCompetitor | undefined {
  return executableSteps(plan).find((step) => step.id === stepRunId);
}

/** Step appended to recover another, keyed by the step it replaces; append-only ordering puts a recovery after its target. */
function replacementIds(plan: RunPlan): Map<string, string> {
  const byReplaced = new Map<string, string>();
  for (const node of plan.steps) {
    if (!isRunPlanCompeteGroup(node) && node.replaces) byReplaced.set(node.replaces, node.id);
  }
  return byReplaced;
}

/** Statuses once recoveries are resolved: a replaced step reads the outcome of the step that replaced it, so an addressed failure stops standing. A withdrawn replacement never ran, so it recovers nothing. */
export function effectiveStepStatuses(plan: RunPlan, statuses: PlanStepStatuses): PlanStepStatuses {
  const byReplaced = replacementIds(plan);
  if (byReplaced.size === 0) return statuses;
  const effective = new Map<string, StepRunState>();
  for (const step of executableSteps(plan).toReversed()) {
    const replacement = byReplaced.get(step.id);
    const recovered = replacement === undefined ? undefined : effective.get(replacement);
    effective.set(
      step.id,
      recovered === undefined || recovered === "withdrawn"
        ? statusOf(statuses, step.id)
        : recovered,
    );
  }
  return effective;
}

function isNodePending(
  node: RunPlanNode,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): boolean {
  return isRunPlanCompeteGroup(node)
    ? (groupStatuses.get(node.id) ?? "queued") === "queued"
    : statusOf(statuses, node.id) === "queued";
}

/** Nodes no scheduler pass will ever start — a withdrawn step and, transitively, every pending node waiting on one; they neither hold the run's delivery nor halt it. */
export function unreachablePlanNodes(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): ReadonlySet<string> {
  const effective = effectiveStepStatuses(plan, statuses);
  const unreachable = new Set<string>();
  for (const node of planExecutionOrder(plan)) {
    const withdrawn = !isRunPlanCompeteGroup(node) && statusOf(effective, node.id) === "withdrawn";
    const blocked =
      isNodePending(node, statuses, groupStatuses) &&
      node.depends_on.some((dependency) => unreachable.has(dependency));
    if (withdrawn || blocked) unreachable.add(node.id);
  }
  return unreachable;
}

function nodeSucceeded(
  node: RunPlanNode,
  effective: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): boolean {
  return isRunPlanCompeteGroup(node)
    ? groupStatuses.get(node.id) === "selected"
    : statusOf(effective, node.id) === "succeeded";
}

function dependencySucceeded(
  plan: RunPlan,
  dependencyId: string,
  effective: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): boolean {
  const dependency = plan.steps.find((node) => node.id === dependencyId);
  return dependency !== undefined && nodeSucceeded(dependency, effective, groupStatuses);
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
  const effective = effectiveStepStatuses(plan, statuses);
  for (const node of planExecutionOrder(plan)) {
    const depsSucceeded = node.depends_on.every((dependency) =>
      dependencySucceeded(plan, dependency, effective, groupStatuses),
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

/** Whether withdrawing this step leaves the plan with nothing reachable at all: that is a run cancel, which stays the operator's explicit decision. */
export function withdrawalEmptiesPlan(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
  stepId: string,
): boolean {
  const after = new Map(statuses);
  after.set(stepId, "withdrawn");
  const unreachable = unreachablePlanNodes(plan, after, groupStatuses);
  return plan.steps.every((node) => unreachable.has(node.id));
}

/** Plan nodes that still-queued work waits on, in plan order; empty when no unfinished dependency holds it back. Work nothing will ever start is not waiting. */
export function blockingPlanDependencies(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses,
): RunPlanNode[] {
  const effective = effectiveStepStatuses(plan, statuses);
  const unreachable = unreachablePlanNodes(plan, statuses, groupStatuses);
  const blocking = new Set<string>();
  for (const node of plan.steps) {
    if (unreachable.has(node.id) || !isNodePending(node, statuses, groupStatuses)) continue;
    for (const dependency of node.depends_on) {
      if (!dependencySucceeded(plan, dependency, effective, groupStatuses))
        blocking.add(dependency);
    }
  }
  return plan.steps.filter((node) => blocking.has(node.id));
}

/** Every node the plan can still reach has delivered, and at least one has: a plan left with nothing reachable delivered nothing. */
export function allStepsSucceeded(
  plan: RunPlan,
  statuses: PlanStepStatuses,
  groupStatuses: PlanCompeteGroupStatuses = new Map(),
): boolean {
  const effective = effectiveStepStatuses(plan, statuses);
  const unreachable = unreachablePlanNodes(plan, statuses, groupStatuses);
  const owed = plan.steps.filter((node) => !unreachable.has(node.id));
  return owed.length > 0 && owed.every((node) => nodeSucceeded(node, effective, groupStatuses));
}

/** How the plan's own steps stand once recoveries are resolved: `failed` outranks `canceled`, `null` means nothing is halted. Compete candidates answer through their group instead. */
export function haltedPlanOutcome(
  plan: RunPlan,
  statuses: PlanStepStatuses,
): "failed" | "canceled" | null {
  const effective = effectiveStepStatuses(plan, statuses);
  const halted = plan.steps
    .filter((node) => !isRunPlanCompeteGroup(node))
    .map((node) => statusOf(effective, node.id))
    .filter(isStepHalted);
  if (halted.length === 0) return null;
  return halted.every((status) => status === "canceled") ? "canceled" : "failed";
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
  if (competitionStates.includes("failed")) return "failed";
  return haltedPlanOutcome(plan, statuses) ?? "canceled";
}
