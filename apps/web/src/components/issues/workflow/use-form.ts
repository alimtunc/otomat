import { runPlanInputSchema, type RunContract } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import type { ExecutionRequestFields } from "@web/lib/execution/request";
import {
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-draft";
import { buildRunPlanInput } from "@web/lib/workflow/plan-input";
import { useRef, useState } from "react";

import { targetRequest, type WorkflowLaunchTarget } from "./launch-target";

export interface UseWorkflowFormOptions {
  target: WorkflowLaunchTarget;
  execution: ExecutionRequestFields;
  canLaunch: boolean;
  /** Branch the run's worktree forks from, resolved by the launch gate. */
  baseBranch: string;
  onLaunched: (run: RunContract) => void;
}

interface WorkflowFormValues {
  goal: string;
  steps: WorkflowNodeDraft[];
}

const WORKFLOW_DEFAULT_VALUES: WorkflowFormValues = { goal: "", steps: [newWorkflowStep(1)] };

/** Owns workflow values, submit-time plan validation, and step-list mutations. */
export function useWorkflowForm({
  target,
  execution,
  canLaunch,
  baseBranch,
  onLaunched,
}: UseWorkflowFormOptions) {
  const { launch, isPending } = useLaunchRun();
  const stepCounter = useRef(1);
  const [planError, setPlanError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: WORKFLOW_DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      if (!canLaunch) return;
      const parsed = runPlanInputSchema.safeParse(buildRunPlanInput(value.steps));
      if (!parsed.success) {
        setPlanError(parsed.error.issues[0]?.message ?? "The workflow plan is invalid.");
        return;
      }
      setPlanError(null);
      const run = await launch({
        ...targetRequest(target, value.goal),
        base_branch: baseBranch,
        plan: parsed.data,
        ...execution,
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
