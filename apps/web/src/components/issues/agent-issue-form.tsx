import type { RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd, Textarea } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchTargetFields } from "@web/components/runs/launch/launch-target-fields";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { useState, type KeyboardEvent } from "react";

export interface AgentIssueFormProps {
  target: Extract<LaunchTargetState, { status: "ready" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

export function AgentIssueForm({
  target,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
}: AgentIssueFormProps) {
  const [promptText, setPromptText] = useState("");
  const { launch, isPending } = useLaunchRun();
  const launchExecution = useLaunchExecution(execution);

  const canSubmit = promptText.trim().length > 0 && launchExecution.canLaunch && !isPending;

  async function submit() {
    if (!canSubmit) return;
    const run = await launch({
      prompt: promptText.trim(),
      project_id: target.repository.project_id,
      base_branch: target.baseBranch,
      ...launchExecution.request,
    });
    if (run) {
      setPromptText("");
      onLaunched(run);
    }
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        <Textarea
          value={promptText}
          onChange={(event) => setPromptText(event.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder='Tell the agent what to do, e.g. "implement nested CSV quoting in the parser and open a PR"'
          rows={4}
          aria-label="Issue prompt"
        />
        <LaunchExecutionPicker
          execution={launchExecution}
          onChange={onExecutionChange}
          label="Ad-hoc run"
        />
        <LaunchTargetFields target={target} disabled={isPending} />
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            Create & launch
            <Kbd tone="on-accent">⌘↵</Kbd>
          </Button>
        }
      />
    </>
  );
}
