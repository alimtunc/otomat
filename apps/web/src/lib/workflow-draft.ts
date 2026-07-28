import type { ModelSelection } from "@otomat/domain";
import { isCompleteModelSelection } from "@web/lib/model-choice";

export interface WorkflowCompetitorDraft {
  key: string;
  name: string;
  prompt: string;
  /** Encoded agent choice (profile or ad-hoc runtime); null inherits the run default. */
  agent: string | null;
  /** Model for this candidate alone; undefined inherits the model of whatever agent it resolves to. */
  model?: ModelSelection;
}

export interface WorkflowStepDraft {
  kind: "step";
  key: string;
  name: string;
  prompt: string;
  /** Encoded agent choice (profile or ad-hoc runtime); null inherits the run default. */
  agent: string | null;
  /** Model for this step alone; undefined inherits the model of whatever agent it resolves to. */
  model?: ModelSelection;
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
    agent: null,
    dependsOn: [],
  };
}

export function newCompetitor(groupKey: string, counter: number): WorkflowCompetitorDraft {
  return {
    key: `${groupKey}-candidate-${counter}`,
    name: "",
    prompt: "",
    agent: null,
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
  if (step.kind === "step") {
    return Boolean(step.prompt.trim()) && isCompleteModelSelection(step.model);
  }
  return (
    step.competitors.length >= 2 &&
    step.competitors.every(
      (competitor) =>
        competitor.name.trim() &&
        competitor.prompt.trim() &&
        isCompleteModelSelection(competitor.model),
    )
  );
}
