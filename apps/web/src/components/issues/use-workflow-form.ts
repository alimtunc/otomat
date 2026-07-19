import { runPlanInputSchema } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import {
  buildRunPlanInput,
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowStepDraft,
} from "@web/lib/workflow-plan";
import { useRef, useState } from "react";

export interface UseWorkflowFormOptions {
  projectId: string | undefined;
  runtime: string | null;
  onLaunched: () => void;
}

/** Owns the workflow launch form: values, plan validation at submit, and the step-list mutations. */
export function useWorkflowForm({ projectId, runtime, onLaunched }: UseWorkflowFormOptions) {
  const { start, isPending } = useStartRunAndNavigate();
  const stepCounter = useRef(1);
  const [planError, setPlanError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { goal: "", steps: [newWorkflowStep(1)] },
    onSubmit: async ({ value }) => {
      if (runtime === null || projectId === undefined) return;
      const plan = buildRunPlanInput(value.steps);
      const parsed = runPlanInputSchema.safeParse(plan);
      if (!parsed.success) {
        setPlanError(parsed.error.issues[0]?.message ?? "The workflow plan is invalid.");
        return;
      }
      setPlanError(null);
      const started = await start({
        prompt: value.goal.trim(),
        runtime,
        plan: parsed.data,
        project_id: projectId,
      });
      if (started) {
        form.reset();
        onLaunched();
      }
    },
  });

  function updateSteps(update: (steps: WorkflowStepDraft[]) => WorkflowStepDraft[]) {
    form.setFieldValue("steps", update(form.getFieldValue("steps")));
    setPlanError(null);
  }

  function addStep() {
    stepCounter.current += 1;
    updateSteps((steps) => [...steps, newWorkflowStep(stepCounter.current)]);
  }

  function addCompeteGroup() {
    stepCounter.current += 1;
    updateSteps((steps) => [...steps, newWorkflowCompeteGroup(stepCounter.current)]);
  }

  return { form, planError, isPending, updateSteps, addStep, addCompeteGroup };
}

export type WorkflowForm = ReturnType<typeof useWorkflowForm>["form"];
