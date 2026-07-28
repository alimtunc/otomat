import type { RunContract } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Kbd, Textarea } from "@otomat/ui";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { isCompleteModelSelection } from "@web/lib/model-choice";
import { isWorkflowNodeComplete } from "@web/lib/workflow-draft";

import { WorkflowPlanBuilder } from "./builder";
import { workflowLaunchBlocker, type WorkflowLaunchTarget } from "./launch-target";
import { useWorkflowForm, type WorkflowForm } from "./use-form";

export interface WorkflowLaunchFormProps {
  target: WorkflowLaunchTarget;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
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

/** Composes a multi-step workflow, on an issue that already exists or on a goal that creates one. */
export function WorkflowLaunchForm({
  target,
  agentChoice,
  onAgentChoice,
  onLaunched,
  onCancel,
}: WorkflowLaunchFormProps) {
  const agents = useLaunchAgentChoice(agentChoice);
  const workflow = useWorkflowForm({ target, agentChoice: agents.choice, onLaunched });
  const { form, isPending } = workflow;
  const blocker = workflowLaunchBlocker(target);

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
        <WorkflowPlanBuilder agents={agents} onAgentChoice={onAgentChoice} workflow={workflow} />
        {blocker === null ? null : <p className="text-xs text-danger">{blocker}</p>}
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              (target.kind === "issue" || hasText(state.values.goal)) &&
              isCompleteModelSelection(state.values.model) &&
              state.values.steps.length > 0 &&
              state.values.steps.every(isWorkflowNodeComplete)
            }
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!(filled && agents.choice !== null && blocker === null && !isPending)}
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
