import { runPlanInputSchema, type RunContract, type StartRunRequest } from "@otomat/domain";
import { useForm } from "@tanstack/react-form";
import { useLaunchRun } from "@web/api/runs/mutations";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import {
  buildRunPlanInput,
  newWorkflowCompeteGroup,
  newWorkflowStep,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";
import { useRef, useState } from "react";

/** What the workflow runs on: an existing issue, or a new issue created from the goal. */
export type WorkflowLaunchTarget =
  | { kind: "issue"; issueId: string }
  | { kind: "project"; projectId: string | undefined };

export interface UseWorkflowFormOptions {
  target: WorkflowLaunchTarget;
  /** The resolved run-level agent choice (profile or ad-hoc runtime), or null when none is launchable. */
  agentChoice: string | null;
  onLaunched: (run: RunContract) => void;
}

const WORKFLOW_DEFAULT_VALUES: { goal: string; steps: WorkflowNodeDraft[] } = {
  goal: "",
  steps: [newWorkflowStep(1)],
};

/** The one reason a target cannot be launched on yet, or null when it can — shown by the form and enforced on submit. */
export function workflowLaunchBlocker(target: WorkflowLaunchTarget): string | null {
  return target.kind === "project" && target.projectId === undefined
    ? "Select a project before launching a workflow."
    : null;
}

function targetRequest(
  target: WorkflowLaunchTarget,
  goal: string,
): Pick<StartRunRequest, "issue_id" | "prompt" | "project_id"> | null {
  if (target.kind === "issue") return { issue_id: target.issueId };
  if (target.projectId === undefined) return null;
  return { prompt: goal.trim(), project_id: target.projectId };
}

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
