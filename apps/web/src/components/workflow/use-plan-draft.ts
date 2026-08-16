import { useForm, useStore } from "@tanstack/react-form";
import {
  freeNodeCounter,
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";
import type { SetStateAction } from "react";

/** The plan a launcher or a preset editor composes; every node name is a field of this form. */
export function usePlanDraft(initial: () => WorkflowNodeDraft[]) {
  const form = useForm({ defaultValues: { steps: initial() } });
  const steps = useStore(form.store, (state) => state.values.steps);
  const setSteps = (update: SetStateAction<WorkflowNodeDraft[]>): void =>
    form.setFieldValue("steps", update);

  return {
    form,
    steps,
    setSteps,
    addStep: () => setSteps((value) => [...value, newWorkflowStep(freeNodeCounter(value))]),
    addCompeteGroup: () =>
      setSteps((value) => [...value, newWorkflowCompeteGroup(freeNodeCounter(value))]),
  };
}

export type PlanDraft = ReturnType<typeof usePlanDraft>;
