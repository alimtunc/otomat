import { Button, DialogBody, Field, FieldControl, FieldLabel, Kbd, Textarea } from "@otomat/ui";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { isWorkflowNodeComplete } from "@web/lib/workflow-plan";

import { WorkflowPlanBuilder } from "./builder";
import { useWorkflowForm } from "./use-form";

export interface WorkflowIssueFormProps {
  projectId: string | undefined;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onLaunched: () => void;
  onCancel: () => void;
}

/** Composes a workflow that creates its own issue from the goal, then follows the run on its detail route. */
export function WorkflowIssueForm({
  projectId,
  agentChoice,
  onAgentChoice,
  onLaunched,
  onCancel,
}: WorkflowIssueFormProps) {
  const agents = useLaunchAgentChoice(agentChoice);
  const workflow = useWorkflowForm({
    target: { kind: "project", projectId },
    agentChoice: agents.choice,
    onLaunched,
  });
  const { form, isPending } = workflow;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
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
        <WorkflowPlanBuilder agents={agents} onAgentChoice={onAgentChoice} workflow={workflow} />
        {projectId === undefined ? (
          <p className="text-xs text-danger">Select a project before launching a workflow.</p>
        ) : null}
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              hasText(state.values.goal) &&
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
                disabled={
                  !(filled && agents.choice !== null && projectId !== undefined && !isPending)
                }
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
