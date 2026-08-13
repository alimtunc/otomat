import { EMPTY_CONTEXT_DRAFT, type ContextDraft } from "@web/lib/context/draft";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { isCompleteModelSelection } from "@web/lib/model-choice";

export interface WorkflowCompetitorDraft {
  key: string;
  name: string;
  context: ContextDraft;
  execution: ExecutionSelection;
}

export interface WorkflowStepDraft {
  kind: "step";
  key: string;
  name: string;
  context: ContextDraft;
  execution: ExecutionSelection;
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
    context: EMPTY_CONTEXT_DRAFT,
    execution: EMPTY_EXECUTION_SELECTION,
    dependsOn: [],
  };
}

export function newCompetitor(groupKey: string, counter: number): WorkflowCompetitorDraft {
  return {
    key: `${groupKey}-candidate-${counter}`,
    name: "",
    context: EMPTY_CONTEXT_DRAFT,
    execution: EMPTY_EXECUTION_SELECTION,
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

/** A node needs a label and a launchable configuration; its instructions are optional, because the attached context and the profile already carry the work. */
export function isWorkflowNodeComplete(step: WorkflowNodeDraft): boolean {
  if (!step.name.trim()) return false;
  if (step.kind === "step") return isCompleteModelSelection(step.execution.model);
  return (
    step.competitors.length >= 2 &&
    step.competitors.every(
      (competitor) =>
        competitor.name.trim() && isCompleteModelSelection(competitor.execution.model),
    )
  );
}
