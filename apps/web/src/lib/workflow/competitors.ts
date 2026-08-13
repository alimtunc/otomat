import type { ExecutionSelection } from "@web/lib/execution/selection";
import { newCompetitor, type WorkflowNodeDraft } from "@web/lib/workflow-draft";

export function setWorkflowCompetitorExecution(
  steps: readonly WorkflowNodeDraft[],
  stepIndex: number,
  competitorIndex: number,
  execution: ExecutionSelection,
): WorkflowNodeDraft[] {
  return steps.map((step, index) => {
    if (index !== stepIndex || step.kind !== "compete") return step;
    return {
      ...step,
      competitors: step.competitors.map((competitor, candidateIndex) =>
        candidateIndex === competitorIndex ? { ...competitor, execution } : competitor,
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
