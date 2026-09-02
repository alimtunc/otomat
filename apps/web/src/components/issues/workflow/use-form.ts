import { runPlanInputSchema, type RunContract } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import type { LaunchBaseFields } from "@web/components/runs/launch/base-request";
import { usePlanDraft } from "@web/components/workflow/use-plan-draft";
import type { ExecutionRequestFields } from "@web/lib/execution/request";
import { newWorkflowStep, type WorkflowNodeDraft } from "@web/lib/workflow-draft";
import { buildRunPlanInput } from "@web/lib/workflow/plan-input";
import { useState } from "react";

import { targetRequest, type WorkflowLaunchTarget } from "./launch-target";

export interface UseWorkflowFormOptions {
  target: WorkflowLaunchTarget;
  execution: ExecutionRequestFields;
  canLaunch: boolean;
  base: LaunchBaseFields;
  onLaunched: (run: RunContract) => void;
}

interface RejectedPlan {
  /** Compared by reference: any later edit yields a new array, which clears the message. */
  steps: WorkflowNodeDraft[];
  message: string;
}

export function useWorkflowForm({
  target,
  execution,
  canLaunch,
  base,
  onLaunched,
}: UseWorkflowFormOptions) {
  const { launch, isPending } = useLaunchRun();
  const plan = usePlanDraft(() => [newWorkflowStep(1)]);
  const [rejected, setRejected] = useState<RejectedPlan | null>(null);

  const form = useForm({
    defaultValues: { goal: "" },
    onSubmit: async ({ value }) => {
      if (!canLaunch) return;
      const parsed = runPlanInputSchema.safeParse(buildRunPlanInput(plan.steps));
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "The workflow plan is invalid.";
        setRejected({ steps: plan.steps, message });
        return;
      }
      const run = await launch({
        ...targetRequest(target, value.goal),
        ...base,
        plan: parsed.data,
        ...execution,
      });
      if (!run) return;
      form.reset();
      plan.setSteps([newWorkflowStep(1)]);
      onLaunched(run);
    },
  });

  return {
    form,
    plan,
    planError: rejected?.steps === plan.steps ? rejected.message : null,
    isPending,
  };
}

export type WorkflowForm = ReturnType<typeof useWorkflowForm>["form"];
export type UseWorkflowFormResult = ReturnType<typeof useWorkflowForm>;
