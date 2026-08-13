import type { IssueContract, RunContract } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Kbd, Textarea } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchTargetFields } from "@web/components/runs/launch/launch-target-fields";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { hasText, submitOnCmdEnter } from "@web/lib/form";
import { issueLaunchPrompt } from "@web/lib/issue/prompt";
import { useState } from "react";

export interface SingleRunLaunchFormProps {
  issue: IssueContract;
  target: Extract<LaunchTargetState, { status: "ready" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

/** One agent turn on this issue, with the prompt it starts from on screen and editable. */
export function SingleRunLaunchForm({
  issue,
  target,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
}: SingleRunLaunchFormProps) {
  const [prompt, setPrompt] = useState(() => issueLaunchPrompt(issue));
  const launchExecution = useLaunchExecution(execution);
  const { launch, isPending } = useLaunchRun();
  const canSubmit = hasText(prompt) && launchExecution.canLaunch && !isPending;

  async function submit() {
    if (!canSubmit) return;
    const run = await launch({
      issue_id: issue.id,
      prompt: prompt.trim(),
      base_branch: target.baseBranch,
      ...launchExecution.request,
    });
    if (run) onLaunched(run);
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        <Field>
          <FieldLabel>Prompt</FieldLabel>
          <FieldControl>
            <Textarea
              autoFocus
              rows={5}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={submitOnCmdEnter(() => void submit())}
              placeholder="What should the agent do on this issue?"
              aria-label="Single run prompt"
            />
          </FieldControl>
        </Field>
        <p className="text-xs text-text-tertiary">
          Prefilled from this issue and sent as-is — the agent receives exactly this text.
        </p>
        <LaunchExecutionPicker
          execution={launchExecution}
          onChange={onExecutionChange}
          label="Single run"
        />
        <LaunchTargetFields target={target} disabled={isPending} />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            Launch run
            <Kbd tone="on-accent">⌘↵</Kbd>
          </Button>
        }
      />
    </>
  );
}
