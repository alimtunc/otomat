import { runPlanInputSchema, type ModelSelection, type RunContract } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/mutations";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import {
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";
import { buildRunPlanInput } from "@web/lib/workflow-plan";
import { useRef, useState } from "react";

import { targetRequest, type WorkflowLaunchTarget } from "./launch-target";

export interface UseWorkflowFormOptions {
  target: WorkflowLaunchTarget;
  /** The resolved run-level agent choice (profile or ad-hoc runtime), or null when none is launchable. */
  agentChoice: string | null;
  onLaunched: (run: RunContract) => void;
}

interface WorkflowFormValues {
  goal: string;
  /** Run-level model override; undefined keeps the agent's own model. Steps without their own model inherit it. */
  model: ModelSelection | undefined;
  steps: WorkflowNodeDraft[];
}

const WORKFLOW_DEFAULT_VALUES: WorkflowFormValues = {
  goal: "",
  model: undefined,
  steps: [newWorkflowStep(1)],
};

/** Owns workflow values, submit-time plan validation, and step-list mutations. */
export function useWorkflowForm({ target, agentChoice, onLaunched }: UseWorkflowFormOptions) {
  const { launch, isPending } = useLaunchRun();
  const stepCounter = useRef(1);
  const [planError, setPlanError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: WORKFLOW_DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      const request = agentChoice === null ? null : targetRequest(target, value.goal);
      if (agentChoice === null || request === null) return;
      const parsed = runPlanInputSchema.safeParse(buildRunPlanInput(value.steps));
      if (!parsed.success) {
        setPlanError(parsed.error.issues[0]?.message ?? "The workflow plan is invalid.");
        return;
      }
      setPlanError(null);
      const run = await launch({
        ...request,
        plan: parsed.data,
        ...agentChoiceToRequest(agentChoice),
        model: value.model,
      });
      if (!run) return;
      form.reset();
      onLaunched(run);
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
export type UseWorkflowFormResult = ReturnType<typeof useWorkflowForm>;
