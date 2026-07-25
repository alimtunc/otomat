import type { RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd } from "@otomat/ui";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { WorkflowPlanBuilder } from "@web/components/issues/workflow/builder";
import { useWorkflowForm } from "@web/components/issues/workflow/use-form";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { submitOnCmdEnter } from "@web/lib/form";
import { isWorkflowNodeComplete } from "@web/lib/workflow-plan";

export interface IssueWorkflowFormProps {
  issueId: string;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

/** Composes a multi-step workflow on an issue that already exists: the issue is the goal, so the run is followed in place. */
export function IssueWorkflowForm({
  issueId,
  agentChoice,
  onAgentChoice,
  onLaunched,
  onCancel,
}: IssueWorkflowFormProps) {
  const agents = useLaunchAgentChoice(agentChoice);
  const workflow = useWorkflowForm({
    target: { kind: "issue", issueId },
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
        <p className="text-xs text-text-tertiary">
          Every step runs on this issue, in order, on the same branch. Steps with no dependency
          start together.
        </p>
        <WorkflowPlanBuilder agents={agents} onAgentChoice={onAgentChoice} workflow={workflow} />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              state.values.steps.length > 0 && state.values.steps.every(isWorkflowNodeComplete)
            }
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!(filled && agents.choice !== null && !isPending)}
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
