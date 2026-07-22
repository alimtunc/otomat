import { runPlanInputSchema } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import {
  buildRunPlanInput,
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";
import { useRef, useState } from "react";

export interface UseWorkflowFormOptions {
  projectId: string | undefined;
  /** The resolved run-level agent choice (profile or ad-hoc runtime), or null when none is launchable. */
  agentChoice: string | null;
  onLaunched: () => void;
}

/** Owns the workflow launch form: values, plan validation at submit, and the step-list mutations. */
export function useWorkflowForm({ projectId, agentChoice, onLaunched }: UseWorkflowFormOptions) {
  const { start, isPending } = useStartRunAndNavigate();
  const stepCounter = useRef(1);
  const [planError, setPlanError] = useState<string | null>(null);

  const defaultValues: { goal: string; steps: WorkflowNodeDraft[] } = {
    goal: "",
    steps: [newWorkflowStep(1)],
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (agentChoice === null || projectId === undefined) return;
      const plan = buildRunPlanInput(value.steps);
      const parsed = runPlanInputSchema.safeParse(plan);
      if (!parsed.success) {
        setPlanError(parsed.error.issues[0]?.message ?? "The workflow plan is invalid.");
        return;
      }
      setPlanError(null);
      const started = await start({
        prompt: value.goal.trim(),
        plan: parsed.data,
        project_id: projectId,
        ...agentChoiceToRequest(agentChoice),
      });
      if (started) {
        form.reset();
        onLaunched();
      }
    },
  });

  function updateSteps(update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) {
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
