import type { ModelSelection, RunPlanInput, RunPlanNodeInput } from "@otomat/domain";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import {
  newCompetitor,
  type WorkflowCompetitorDraft,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";

/** Keeps every dependency pointing at an earlier, still-existing top-level node. */
function sanitizeWorkflowSteps(steps: readonly WorkflowNodeDraft[]): WorkflowNodeDraft[] {
  const earlier = new Set<string>();
  return steps.map((step) => {
    const dependsOn = step.dependsOn.filter((key) => earlier.has(key));
    earlier.add(step.key);
    return { ...step, dependsOn };
  });
}

export function moveWorkflowStep(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  direction: -1 | 1,
): WorkflowNodeDraft[] {
  const target = index + direction;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) {
    return [...steps];
  }
  const next = [...steps];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return sanitizeWorkflowSteps(next);
}

export function removeWorkflowStep(
  steps: readonly WorkflowNodeDraft[],
  index: number,
): WorkflowNodeDraft[] {
  return sanitizeWorkflowSteps(steps.filter((_, stepIndex) => stepIndex !== index));
}

export function setWorkflowStepAgent(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  agent: string | null,
): WorkflowNodeDraft[] {
  // Another agent lists other models, so a kept selection would silently become a custom one.
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, agent, model: undefined } : step,
  );
}

/** Nodes without their own agent follow the run default, so a run-level agent change orphans their kept models. */
export function clearInheritedNodeModels(steps: readonly WorkflowNodeDraft[]): WorkflowNodeDraft[] {
  return steps.map((step) => {
    if (step.kind === "compete") {
      return {
        ...step,
        competitors: step.competitors.map((competitor) =>
          competitor.agent === null ? { ...competitor, model: undefined } : competitor,
        ),
      };
    }
    return step.agent === null ? { ...step, model: undefined } : step;
  });
}

export function setWorkflowStepModel(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  model: ModelSelection | undefined,
): WorkflowNodeDraft[] {
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, model } : step,
  );
}

function patchCompetitor(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  update: Partial<Omit<WorkflowCompetitorDraft, "key">>,
): WorkflowNodeDraft[] {
  return steps.map((step, index) => {
    if (index !== stepIndex || step.kind !== "compete") return step;
    return {
      ...step,
      competitors: step.competitors.map((competitor, candidateIndex) =>
        candidateIndex === competitorIndex ? { ...competitor, ...update } : competitor,
      ),
    };
  });
}

/** Changing the agent goes through `setWorkflowCompetitorAgent` so the model reset cannot be skipped. */
export function updateWorkflowCompetitor(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  update: Partial<Pick<WorkflowCompetitorDraft, "name" | "prompt" | "model">>,
): WorkflowNodeDraft[] {
  return patchCompetitor(steps, stepIndex, competitorIndex, update);
}

export function setWorkflowCompetitorAgent(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  agent: string | null,
): WorkflowNodeDraft[] {
  // Another agent lists other models, so a kept selection would silently become a custom one.
  return patchCompetitor(steps, stepIndex, competitorIndex, { agent, model: undefined });
}

export function addWorkflowCompetitor(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
): WorkflowNodeDraft[] {
  return steps.map((step, index) => {
    if (index !== stepIndex || step.kind !== "compete") return step;
    const candidateKeys = new Set(step.competitors.map((competitor) => competitor.key));
    let nextCounter = step.competitors.length + 1;
    while (candidateKeys.has(`${step.key}-candidate-${nextCounter}`)) nextCounter += 1;
    return {
      ...step,
      competitors: [...step.competitors, newCompetitor(step.key, nextCounter)],
    };
  });
}

export function removeWorkflowCompetitor(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
): WorkflowNodeDraft[] {
  return steps.map((step, index) => {
    if (index !== stepIndex || step.kind !== "compete" || step.competitors.length <= 2) return step;
    return {
      ...step,
      competitors: step.competitors.filter(
        (_, candidateIndex) => candidateIndex !== competitorIndex,
      ),
    };
  });
}

export function toggleWorkflowDependency(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  dependencyKey: string,
): WorkflowNodeDraft[] {
  return sanitizeWorkflowSteps(
    steps.map((step, stepIndex) => {
      if (stepIndex !== index) return step;
      const has = step.dependsOn.includes(dependencyKey);
      return {
        ...step,
        dependsOn: has
          ? step.dependsOn.filter((key) => key !== dependencyKey)
          : [...step.dependsOn, dependencyKey],
      };
    }),
  );
}

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
          prompt: competitor.prompt.trim(),
        })),
      };
    }
    return {
      id: step.key,
      name: step.name.trim(),
      ...nodeAgentFields(step.agent),
      model: step.model,
      prompt: step.prompt.trim(),
      depends_on: step.dependsOn,
    };
  });
  return { version: 1, steps: nodes };
}
