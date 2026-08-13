import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icon,
} from "@otomat/ui";
import { useIssue } from "@web/api/issues/queries";
import { AppendStepForm } from "@web/components/runs/steps/append-step-form";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { useState } from "react";

export interface AddStepDialogProps {
  issueId: string;
  /** Fills the width of a narrow side pane instead of hugging its label. */
  stretch?: boolean;
}

const CLOSED_NOTE = "This issue's workspace is closed — launch a new cycle from the issue.";

/** The cockpit's own way into the open cycle: one step, appended to the run that already holds the workspace. */
export function AddStepDialog({ issueId, stretch = false }: AddStepDialogProps) {
  const [open, setOpen] = useState(false);
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  const issue = useIssue(issueId);
  const workspace = issue.data?.workspace;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={stretch ? "flex-1" : undefined}
            disabled={workspace?.state !== "open"}
            title={workspace?.state === "open" ? undefined : CLOSED_NOTE}
          >
            <Icon name="plus" aria-hidden />
            Add step
          </Button>
        }
      />
      <DialogContent aria-label="Add a step to this run">
        <DialogHeader>
          <DialogTitle>Add step</DialogTitle>
        </DialogHeader>
        {issue.data && workspace?.state === "open" ? (
          <AppendStepForm
            issue={issue.data}
            workspace={workspace}
            execution={execution}
            onExecutionChange={setExecution}
            onAppended={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
