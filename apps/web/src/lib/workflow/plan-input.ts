import type { RunPlanInput, RunPlanNodeInput } from "@otomat/domain";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

import { sanitizeWorkflowSteps } from "./steps";

/** Decodes an agent choice into a plan node's `agent` (runtime id) and optional `profile_id`. */
function nodeAgentFields(choice: string | null): { agent: string | null; profile_id?: string } {
  const request = agentChoiceToRequest(choice);
  if (request.profile_id) return { agent: null, profile_id: request.profile_id };
  if (request.runtime) return { agent: request.runtime };
  return { agent: null };
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
          ...nodeAgentFields(competitor.agent),
          model: competitor.model,
          effort: competitor.effort,
          prompt: competitor.prompt.trim(),
        })),
      };
    }
    return {
      id: step.key,
      name: step.name.trim(),
      ...nodeAgentFields(step.agent),
      model: step.model,
      effort: step.effort,
      prompt: step.prompt.trim(),
      depends_on: step.dependsOn,
    };
  });
  return { version: 1, steps: nodes };
}
