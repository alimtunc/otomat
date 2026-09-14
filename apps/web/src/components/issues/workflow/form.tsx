import type { RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd } from "@otomat/ui";
import { useStore } from "@tanstack/react-form";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { useDraftPresence } from "@web/components/issues/use-draft-presence";
import { launchBaseFields } from "@web/components/runs/launch/base/request";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasText, submitOnCmdEnter } from "@web/lib/form";
import { isWorkflowNodeComplete } from "@web/lib/workflow-draft";
import { hasWorkflowDraft } from "@web/lib/workflow/content";
import { clearInheritedNodeOverrides } from "@web/lib/workflow/steps";
import { useEffect, useEffectEvent, useRef } from "react";

import { WorkflowPlanBuilder } from "./builder";
import { type WorkflowLaunchTarget } from "./launch-target";
import { WorkflowTargetIntro } from "./target-intro";
import { useWorkflowForm } from "./use-form";

export interface WorkflowLaunchFormProps {
  target: WorkflowLaunchTarget;
  worktreeTarget: ReadyLaunchTarget;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
  onDraftChange?: (hasDraft: boolean) => void;
  autoFocus?: boolean;
}

export function WorkflowLaunchForm({
  target,
  worktreeTarget,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
  onDraftChange,
  autoFocus = true,
}: WorkflowLaunchFormProps) {
  const launchExecution = useLaunchExecution(execution);
  const workflow = useWorkflowForm({
    target,
    execution: launchExecution.request,
    canLaunch: launchExecution.canLaunch,
    base: launchBaseFields(worktreeTarget),
    onLaunched,
  });
  const { form, plan, isPending } = workflow;
  const inheritedAgent = launchExecution.selection.agent;
  const previousAgent = useRef(inheritedAgent);
  const rescope = useEffectEvent(() => plan.setSteps(clearInheritedNodeOverrides));
  // otomat-allow-effect: a shared launch agent change invalidates inherited step overrides even while this mode is hidden.
  useEffect(() => {
    if (previousAgent.current !== inheritedAgent) rescope();
    previousAgent.current = inheritedAgent;
  }, [inheritedAgent]);
  const hasGoal = useStore(form.store, (state) => hasText(state.values.goal));
  useDraftPresence(hasGoal || hasWorkflowDraft(plan.steps), onDraftChange);
  const composed =
    launchExecution.canLaunch && plan.steps.length > 0 && plan.steps.every(isWorkflowNodeComplete);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex max-h-[62vh] min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <WorkflowTargetIntro target={target} form={form} autoFocus={autoFocus} />
        <WorkflowPlanBuilder
          execution={launchExecution}
          onExecutionChange={onExecutionChange}
          workflow={workflow}
          target={target}
          worktreeTarget={worktreeTarget}
        />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe selector={(state) => state.values.goal}>
            {(goal) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!(composed && (target.kind === "issue" || hasText(goal)) && !isPending)}
              >
                Launch workflow
                <Kbd tone="on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
