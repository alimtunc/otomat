import {
  unreachablePlanNodes,
  type EventEnvelope,
  type RunDetail,
  type RunPlan,
} from "@otomat/domain";

function dependencyNames(
  plan: RunPlan,
  stepId: string,
  keep: (dependencyId: string) => boolean,
): string[] {
  const step = plan.steps.find((candidate) => candidate.id === stepId);
  if (!step) return [];
  const nameById = new Map(plan.steps.map((node) => [node.id, node.name]));
  return step.depends_on.filter(keep).map((dependency) => nameById.get(dependency) ?? dependency);
}

/** A plan step id is also its step_run id. */
export function stepDependencyNames(plan: RunPlan, stepId: string): string[] {
  return dependencyNames(plan, stepId, () => true);
}

/** Dependencies of a step that will never run — a canceled step or work stuck behind one — so the row explains a block instead of a wait. */
export function blockedDependencyNames(detail: RunDetail, stepId: string): string[] {
  const plan = detail.run.plan_json;
  const unreachable = unreachablePlanNodes(
    plan,
    new Map(detail.steps.map((step) => [step.id, step.status])),
    new Map(detail.compete_groups.map((group) => [group.id, group.status])),
  );
  return dependencyNames(plan, stepId, (dependency) => unreachable.has(dependency));
}

/** The step the ledger last carried an event for: the one the cockpit is following. */
export function activeStepRunId(events: readonly EventEnvelope[]): string | null {
  return events.findLast((event) => event.step_run_id !== null)?.step_run_id ?? null;
}

/** The step a surface shows: the caller's choice when it still exists, else the live one, else the first. */
export function selectedStepRunId(
  detail: RunDetail,
  events: readonly EventEnvelope[],
  requested: string | undefined,
): string | null {
  if (requested !== undefined && detail.steps.some((step) => step.id === requested)) {
    return requested;
  }
  return (
    activeStepRunId(events) ??
    detail.steps.toSorted((left, right) => left.idx - right.idx)[0]?.id ??
    null
  );
}

/** Every event attributed to one step, directly or through a session that step owns. */
export function eventsForStep(
  detail: RunDetail,
  stepId: string,
  events: readonly EventEnvelope[],
): EventEnvelope[] {
  const sessionIds = new Set(
    detail.sessions
      .filter((session) => session.step_run_id === stepId)
      .map((session) => session.id),
  );
  return events.filter(
    (event) =>
      event.step_run_id === stepId ||
      (event.agent_session_id !== null && sessionIds.has(event.agent_session_id)),
  );
}
