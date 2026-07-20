import type { RunPlanInput, RunPlanNodeInput } from "@otomat/domain";

export interface WorkflowCompetitorDraft {
  key: string;
  name: string;
  prompt: string;
  runtime: string | null;
}

export interface WorkflowStepDraft {
  kind: "step";
  key: string;
  name: string;
  prompt: string;
  runtime: string | null;
  /** Keys of top-level nodes this one waits for; competitors are never valid dependency targets. */
  dependsOn: string[];
}

/** Compete nodes own at least two executable competitors. */
export interface WorkflowCompeteDraft {
  kind: "compete";
  key: string;
  name: string;
  dependsOn: string[];
  competitors: WorkflowCompetitorDraft[];
}

/** One top-level dependency node. */
export type WorkflowNodeDraft = WorkflowStepDraft | WorkflowCompeteDraft;

export function newWorkflowStep(counter: number): WorkflowStepDraft {
  return {
    kind: "step",
    key: `step-${counter}`,
    name: "",
    prompt: "",
    runtime: null,
    dependsOn: [],
  };
}

function newCompetitor(groupKey: string, counter: number): WorkflowCompetitorDraft {
  return {
    key: `${groupKey}-candidate-${counter}`,
    name: "",
    prompt: "",
    runtime: null,
  };
}

export function newWorkflowCompeteGroup(counter: number): WorkflowCompeteDraft {
  const key = `compete-${counter}`;
  return {
    kind: "compete",
    key,
    name: "",
    dependsOn: [],
    competitors: [newCompetitor(key, 1), newCompetitor(key, 2)],
  };
}

/** The single identifier a competitor is known by in the form — shown and announced. */
export function competitorLabel(competitorIndex: number): string {
  return `Candidate ${String.fromCharCode(65 + competitorIndex)}`;
}

export function workflowExecutableCount(steps: readonly WorkflowNodeDraft[]): number {
  return steps.reduce(
    (count, step) => count + (step.kind === "compete" ? step.competitors.length : 1),
    0,
  );
}

export function isWorkflowNodeComplete(step: WorkflowNodeDraft): boolean {
  if (!step.name.trim()) return false;
  if (step.kind === "step") return Boolean(step.prompt.trim());
  return (
    step.competitors.length >= 2 &&
    step.competitors.every((competitor) => competitor.name.trim() && competitor.prompt.trim())
  );
}

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

export function setWorkflowStepRuntime(
  steps: readonly WorkflowNodeDraft[],
  index: number,
  runtime: string | null,
): WorkflowNodeDraft[] {
  return steps.map((step, stepIndex) =>
    stepIndex === index && step.kind === "step" ? { ...step, runtime } : step,
  );
}

export function updateWorkflowCompetitor(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  update: Partial<Pick<WorkflowCompetitorDraft, "name" | "prompt" | "runtime">>,
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
          agent: competitor.runtime,
          prompt: competitor.prompt.trim(),
        })),
      };
    }
    return {
      id: step.key,
      name: step.name.trim(),
      agent: step.runtime,
      prompt: step.prompt.trim(),
      depends_on: step.dependsOn,
    };
  });
  return { version: 1, steps: nodes };
}
