import type { EventEnvelope, RunDetail, RunPlan } from "@otomat/domain";

/** Display names of the plan steps a given step waits for (plan step id == step_run id). */
export function stepDependencyNames(plan: RunPlan, stepId: string): string[] {
  const nameById = new Map(plan.steps.map((step) => [step.id, step.name]));
  const step = plan.steps.find((candidate) => candidate.id === stepId);
  if (!step) return [];
  return step.depends_on.map((dependency) => nameById.get(dependency) ?? dependency);
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
