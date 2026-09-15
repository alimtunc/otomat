import type { RunPlanInput, RunPlanNodeInput } from "@otomat/domain";
import { contextRequestFields } from "@web/lib/context/draft";
import { executionRequestFields, type ExecutionRequestFields } from "@web/lib/execution/request";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

import { sanitizeWorkflowSteps } from "./steps";

function nodeExecution(execution: ExecutionSelection) {
  const { profile_id, runtime, model, options } = executionRequestFields(execution);
  const node: { agent: string | null } & Omit<ExecutionRequestFields, "runtime"> = {
    agent: runtime ?? null,
  };
  if (profile_id !== undefined) node.profile_id = profile_id;
  if (model !== undefined) node.model = model;
  if (options !== undefined) node.options = options;
  return node;
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
          ...contextRequestFields(competitor.context),
        })),
      };
    }
    return {
      id: step.key,
      name: step.name.trim(),
      ...nodeExecution(step.execution),
      ...contextRequestFields(step.context),
      depends_on: step.dependsOn,
    };
  });
  return { version: 1, steps: nodes };
}
