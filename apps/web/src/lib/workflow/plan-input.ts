import type { RunPlanInput, RunPlanNodeInput } from "@otomat/domain";
import { executionRequestFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

import { sanitizeWorkflowSteps } from "./steps";

function nodeExecution(execution: ExecutionSelection) {
  const { profile_id, runtime, model, options } = executionRequestFields(execution);
  return {
    agent: runtime ?? null,
    ...(profile_id === undefined ? {} : { profile_id }),
    ...(model === undefined ? {} : { model }),
    ...(options === undefined ? {} : { options }),
  };
}

export function buildRunPlanInput(steps: readonly WorkflowNodeDraft[]): RunPlanInput {
  const nodes: RunPlanNodeInput[] = sanitizeWorkflowSteps(steps).map((step) => {
    if (step.kind === "compete") {
      return {
        id: step.key,
        name: step.name.trim(),
        depends_on: step.dependsOn,
        compete: step.competitors.map((competitor) => ({
          id: competitor.key,
          name: competitor.name.trim(),
          ...nodeExecution(competitor.execution),
          prompt: competitor.prompt.trim(),
        })),
      };
    }
    return {
      id: step.key,
      name: step.name.trim(),
      ...nodeExecution(step.execution),
      prompt: step.prompt.trim(),
      depends_on: step.dependsOn,
    };
  });
  return { version: 1, steps: nodes };
}
