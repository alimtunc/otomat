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

/** A run of consecutive timeline events belonging to one step (or to the run itself). */
export interface TimelineStepGroup {
  /** Null for run-level events that precede any step attribution. */
  stepRunId: string | null;
  stepName: string | null;
  events: EventEnvelope[];
}

/** Splits the seq-ordered list at each `step_run_id` change; run-level (null) events stay in the current section. */
export function groupEventsByStep(
  events: readonly EventEnvelope[],
  steps: readonly { id: string; name: string }[],
): TimelineStepGroup[] {
  const nameById = new Map(steps.map((step) => [step.id, step.name]));
  const groups: TimelineStepGroup[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const stepRunId = event.step_run_id;
    if (last && (stepRunId === null || stepRunId === last.stepRunId)) {
      last.events.push(event);
      continue;
    }
    groups.push({
      stepRunId,
      stepName: stepRunId === null ? null : (nameById.get(stepRunId) ?? null),
      events: [event],
    });
  }
  return groups;
}
