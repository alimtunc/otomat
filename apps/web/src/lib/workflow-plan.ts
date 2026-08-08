import type {
  EffortSelection,
  ModelSelection,
  RunPlanInput,
  RunPlanNodeInput,
} from "@otomat/domain";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import {
  newCompetitor,
  type WorkflowCompetitorDraft,
  type WorkflowNodeDraft,
  type WorkflowStepDraft,
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
  // Another agent lists other models and announces other effort levels, so both selections return to inherit.
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step"
      ? { ...step, agent, model: undefined, effort: undefined }
      : step,
  );
}

/** A selection is reset when what scopes it changes: the model follows the agent, the effort level follows both. */
function inheritedOverrides(
  node: Pick<WorkflowStepDraft, "agent" | "model" | "effort">,
  changed: "agent" | "model",
): Pick<WorkflowStepDraft, "model" | "effort"> {
  if (node.agent !== null) return { model: node.model, effort: node.effort };
  if (changed === "agent") return { model: undefined, effort: undefined };
  return { model: node.model, effort: node.model === undefined ? undefined : node.effort };
}

/** Nodes without their own agent follow the run default, so a run-level change orphans what they kept under it. */
export function clearInheritedNodeOverrides(
  steps: readonly WorkflowNodeDraft[],
  changed: "agent" | "model",
): WorkflowNodeDraft[] {
  return steps.map((step) => {
    if (step.kind === "step") return { ...step, ...inheritedOverrides(step, changed) };
    return {
      ...step,
      competitors: step.competitors.map((competitor) => ({
        ...competitor,
        ...inheritedOverrides(competitor, changed),
      })),
    };
  });
}

export function setWorkflowStepModel(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  model: ModelSelection | undefined,
): WorkflowNodeDraft[] {
  // Reasoning levels are published per model, so a kept level may not exist under the new one.
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, model, effort: undefined } : step,
  );
}

export function setWorkflowStepEffort(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  effort: EffortSelection | undefined,
): WorkflowNodeDraft[] {
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, effort } : step,
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

export function setWorkflowCompetitorAgent(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  agent: string | null,
): WorkflowNodeDraft[] {
  // Another agent lists other models and announces other effort levels, so both selections return to inherit.
  return patchCompetitor(steps, stepIndex, competitorIndex, {
    agent,
    model: undefined,
    effort: undefined,
  });
}

export function setWorkflowCompetitorModel(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  model: ModelSelection | undefined,
): WorkflowNodeDraft[] {
  // Reasoning levels are published per model, so a kept level may not exist under the new one.
  return patchCompetitor(steps, stepIndex, competitorIndex, { model, effort: undefined });
}

export function setWorkflowCompetitorEffort(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  effort: EffortSelection | undefined,
): WorkflowNodeDraft[] {
  return patchCompetitor(steps, stepIndex, competitorIndex, { effort });
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
