import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

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

export function setWorkflowStepExecution(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  execution: ExecutionSelection,
): WorkflowNodeDraft[] {
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, execution } : step,
  );
}

function rescopeExecution(execution: ExecutionSelection): ExecutionSelection {
  return execution.agent === null ? EMPTY_EXECUTION_SELECTION : execution;
}

/** A node inheriting the run's agent resolves against the run's model and options, so a run-level agent change orphans what it kept under the old scope. */
export function clearInheritedNodeOverrides(
  steps: readonly WorkflowNodeDraft[],
): WorkflowNodeDraft[] {
  return steps.map((step) => {
    if (step.kind === "step") return { ...step, execution: rescopeExecution(step.execution) };
    return {
      ...step,
      competitors: step.competitors.map((competitor) => ({
        ...competitor,
        execution: rescopeExecution(competitor.execution),
      })),
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
