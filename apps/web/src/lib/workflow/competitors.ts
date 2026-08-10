import type { EffortSelection, ModelSelection } from "@otomat/domain";
import {
  newCompetitor,
  type WorkflowCompetitorDraft,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";

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
