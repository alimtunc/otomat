import type { RequestFixRequest } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  Icon,
} from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useIssue } from "@web/api/issues/queries";
import { useRequestFix } from "@web/api/reviews/mutations";
import { ContextComposer } from "@web/components/context/context-composer";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { contextRequestFields, EMPTY_CONTEXT_DRAFT } from "@web/lib/context/draft";
import { profileRequestFields } from "@web/lib/execution/request";
import { EMPTY_EXECUTION_SELECTION, type ExecutionSelection } from "@web/lib/execution/selection";
import { useState } from "react";

export interface ReviewFixStepDialogProps {
  runId: string;
  issueId: string | null;
  count: number;
  disabled: boolean;
}

export function ReviewFixStepDialog({ runId, issueId, count, disabled }: ReviewFixStepDialogProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [context, setContext] = useState(EMPTY_CONTEXT_DRAFT);
  const [execution, setExecution] = useState<ExecutionSelection>(EMPTY_EXECUTION_SELECTION);
  const issue = useIssue(issueId);
  const fix = useRequestFix(runId);
  const launchExecution = useLaunchExecution(execution, "profiles");
  const profile = profileRequestFields(launchExecution.request);
  const canSubmit = launchExecution.canLaunch && profile !== null && !fix.isPending;

  const submit = (): void => {
    if (!canSubmit || profile === null) return;
    const request: RequestFixRequest = {
      ...contextRequestFields(context),
      ...profile,
    };
    fix.mutate(request, {
      onSuccess: (response) => {
        setOpen(false);
        void navigate({
          to: "/runs/$runId",
          params: { runId },
          search: { step: response.step_run_id },
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="primary" size="sm" disabled={disabled}>
            <Icon name="wand-2" aria-hidden />
            {count === 1 ? "Fix 1 agent comment" : `Fix ${count} agent comments`}
          </Button>
        }
      />
      <DialogContent aria-label="Fix the open agent comments">
        <DialogHeader>
          <span className="text-sm text-text-secondary">
            {count === 1 ? "1 comment becomes a new step" : `${count} comments become a new step`}
          </span>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-text-tertiary">
            The step is appended to this issue’s plan and runs in its workspace. Each open agent
            comment, its pinned hunk, the current file and the current diff sha are frozen as its
            context.
          </p>
          <ContextComposer
            issue={issue.data ?? null}
            projectId={issue.data?.project_id}
            value={context}
            onChange={setContext}
            label="Fix step"
            noteRows={2}
          />
          <LaunchExecutionPicker
            execution={launchExecution}
            onChange={setExecution}
            label="Fix step"
            scope="profiles"
          />
        </DialogBody>
        <IssueFormFooter
          onCancel={() => setOpen(false)}
          submit={
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={fix.isPending}
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
