import type { StepRunRow } from "@otomat/db";
import {
  CONTEXT_STEP_REPORT_MAX_LENGTH,
  isRunPlanCompeteGroup,
  type ContextProgress,
  type EventEnvelope,
  type RunPlan,
} from "@otomat/domain";

/** The plan node ids a step waits on; a competitor waits on whatever its group waits on. */
export function planDependencyIds(plan: RunPlan, stepRunId: string): Set<string> {
  for (const node of plan.steps) {
    if (isRunPlanCompeteGroup(node)) {
      if (node.compete.some((candidate) => candidate.id === stepRunId)) {
        return new Set(node.depends_on);
      }
      continue;
    }
    if (node.id === stepRunId) return new Set(node.depends_on);
  }
  return new Set();
}

/** What a finished step reported, newest message first. Reasoning frames are skipped: they are not what the step said it did. */
export function stepReport(messages: readonly EventEnvelope[]): string | null {
  const spoken = messages.find((event) => event.payload["thinking"] !== true);
  const text = spoken?.payload["text"];
  if (typeof text !== "string" || text.trim() === "") return null;
  return text.length <= CONTEXT_STEP_REPORT_MAX_LENGTH
    ? text
    : `…${text.slice(-CONTEXT_STEP_REPORT_MAX_LENGTH)}`;
}

/** A competitor inherits its group's edges, so a dependency on the group is a dependency on each candidate. */
export function isDependencyStep(step: StepRunRow, dependencies: ReadonlySet<string>): boolean {
  return (
    dependencies.has(step.id) ||
    (step.compete_group_id !== null && dependencies.has(step.compete_group_id))
  );
}

export interface ProgressContextInput {
  steps: readonly StepRunRow[];
  /** The step this session runs. */
  stepRunId: string;
  dependencies: ReadonlySet<string>;
  /** Report of each dependency step; a step that produced none is absent. */
  reports: ReadonlyMap<string, string>;
}

/** Only the steps this one waits on carry their report, so the dossier never grows into the run's whole transcript. */
export function progressContext(input: ProgressContextInput): ContextProgress {
  return {
    step_name: input.steps.find((step) => step.id === input.stepRunId)?.name ?? "",
    steps: input.steps.map((step) => {
      const dependency = isDependencyStep(step, input.dependencies);
      return {
        id: step.id,
        name: step.name,
        status: step.status,
        current: step.id === input.stepRunId,
        dependency,
        report: dependency ? (input.reports.get(step.id) ?? null) : null,
      };
    }),
  };
}
