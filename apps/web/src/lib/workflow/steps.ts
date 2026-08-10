import type { EffortSelection, ModelSelection } from "@otomat/domain";
import type { WorkflowNodeDraft, WorkflowStepDraft } from "@web/lib/workflow-draft";

/** Keeps every dependency pointing at an earlier, still-existing top-level node. */
export function sanitizeWorkflowSteps(steps: readonly WorkflowNodeDraft[]): WorkflowNodeDraft[] {
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
