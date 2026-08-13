import { FIX_REVIEW_COMMENTS_STEP_NAME, type RequestFixRequest } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  Input,
} from "@otomat/ui";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import type { ReviewSelection } from "@web/components/runs/review/use-selection";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { hasText } from "@web/lib/form";
import { useState } from "react";

export interface ReviewFixStepDialogProps {
  selection: ReviewSelection;
  /** True while the run cannot take a step; the trigger stays visible and explains itself. */
  disabled: boolean;
}

/** Turns the selected comments into an appended step, on an agent the user picks here rather than inherits. */
export function ReviewFixStepDialog({ selection, disabled }: ReviewFixStepDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(FIX_REVIEW_COMMENTS_STEP_NAME);
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  const launchExecution = useLaunchExecution(execution);
  const canSubmit = hasText(name) && launchExecution.canLaunch && !selection.isFixPending;

  function submit(): void {
    if (!canSubmit) return;
    const request: RequestFixRequest = {
      comment_ids: [...selection.selectedIds],
      name: name.trim(),
      ...launchExecution.request,
    };
    selection.requestFix(request, () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="primary" size="sm" disabled={disabled}>
            <Icon name="wand-2" aria-hidden />
            Fix selected comments with AI
          </Button>
        }
      />
      <DialogContent aria-label="Fix the selected review comments">
        <DialogHeader>
          <span className="text-sm text-text-secondary">
            {selection.selectedIds.size === 1
              ? "1 comment becomes a new step"
              : `${selection.selectedIds.size} comments become a new step`}
          </span>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            The step is appended to this issue’s plan and runs in its workspace. Each selected
            comment, its pinned hunk, the current file and the current diff sha are frozen as its
            context.
          </p>
          <Field>
            <FieldLabel>Step name</FieldLabel>
            <FieldControl>
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="Fix step name"
              />
            </FieldControl>
          </Field>
          <LaunchExecutionPicker
            execution={launchExecution}
            onChange={setExecution}
            label="Fix step"
          />
        </DialogBody>
        <IssueFormFooter
          onCancel={() => setOpen(false)}
          submit={
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={selection.isFixPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              Add fix step
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
