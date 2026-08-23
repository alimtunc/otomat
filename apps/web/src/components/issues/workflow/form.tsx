import type { RunContract } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Kbd, Textarea } from "@otomat/ui";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { isWorkflowNodeComplete } from "@web/lib/workflow-draft";

import { WorkflowPlanBuilder } from "./builder";
import { type WorkflowLaunchTarget } from "./launch-target";
import { useWorkflowForm, type WorkflowForm } from "./use-form";

export interface WorkflowLaunchFormProps {
  target: WorkflowLaunchTarget;
  worktreeTarget: ReadyLaunchTarget;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

function WorkflowTargetIntro({
  target,
  form,
}: {
  target: WorkflowLaunchTarget;
  form: WorkflowForm;
}) {
  if (target.kind === "issue") {
    return (
      <p className="text-xs text-text-tertiary">
        Every step runs on this issue, in order, on the same branch. Steps with no dependency start
        together.
      </p>
    );
  }
  return (
    <form.Field
      name="goal"
      validators={{ onChange: requiredTrimmed("Describe the overall goal.") }}
    >
      {(field) => (
        <Field {...fieldErrorProps(field.state.meta)}>
          <FieldLabel>Goal</FieldLabel>
          <FieldControl>
            <Textarea
              autoFocus
              rows={2}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="What should this workflow achieve? Becomes the issue."
              aria-label="Workflow goal"
            />
          </FieldControl>
        </Field>
      )}
    </form.Field>
  );
}

export function WorkflowLaunchForm({
  target,
  worktreeTarget,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
}: WorkflowLaunchFormProps) {
  const launchExecution = useLaunchExecution(execution);
  const workflow = useWorkflowForm({
    target,
    execution: launchExecution.request,
    canLaunch: launchExecution.canLaunch,
    baseBranch: worktreeTarget.baseBranch,
    onLaunched,
  });
  const { form, plan, isPending } = workflow;
  const composed =
    launchExecution.canLaunch && plan.steps.length > 0 && plan.steps.every(isWorkflowNodeComplete);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
        <WorkflowTargetIntro target={target} form={form} />
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
