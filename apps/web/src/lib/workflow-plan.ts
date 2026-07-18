import type { RunPlanInput, RunPlanStepInput } from "@otomat/domain";

/** One editable step of the workflow builder; `key` is the form-local plan step id. */
export interface WorkflowStepDraft {
  key: string;
  name: string;
  prompt: string;
  /** Runtime adapter id for this step; null inherits the launch's default runtime. */
  runtime: string | null;
  /** Keys of steps this one waits for — always earlier in the list, so the plan stays acyclic by construction. */
  dependsOn: string[];
}

export function newWorkflowStep(counter: number): WorkflowStepDraft {
  return { key: `step-${counter}`, name: "", prompt: "", runtime: null, dependsOn: [] };
}

/** Keeps every dependency pointing at an earlier, still-existing step. */
function sanitizeWorkflowSteps(steps: readonly WorkflowStepDraft[]): WorkflowStepDraft[] {
  const earlier = new Set<string>();
  return steps.map((step) => {
    const dependsOn = step.dependsOn.filter((key) => earlier.has(key));
    earlier.add(step.key);
    return { ...step, dependsOn };
  });
}

export function moveWorkflowStep(
  steps: readonly WorkflowStepDraft[],
  index: number,
  direction: -1 | 1,
): WorkflowStepDraft[] {
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
  steps: readonly WorkflowStepDraft[],
  index: number,
): WorkflowStepDraft[] {
  return sanitizeWorkflowSteps(steps.filter((_, stepIndex) => stepIndex !== index));
}

export function setWorkflowStepRuntime(
  steps: readonly WorkflowStepDraft[],
  index: number,
  runtime: string | null,
): WorkflowStepDraft[] {
  return steps.map((step, stepIndex) => (stepIndex === index ? { ...step, runtime } : step));
}

export function toggleWorkflowDependency(
  steps: readonly WorkflowStepDraft[],
  index: number,
  dependencyKey: string,
): WorkflowStepDraft[] {
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

export function buildRunPlanInput(steps: readonly WorkflowStepDraft[]): RunPlanInput {
  const planSteps: RunPlanStepInput[] = sanitizeWorkflowSteps(steps).map((step) => ({
    id: step.key,
    name: step.name.trim(),
    agent: step.runtime,
    prompt: step.prompt.trim(),
    depends_on: step.dependsOn,
  }));
  return { version: 1, steps: planSteps };
}
