import type { IssueContract, RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { ContextComposer } from "@web/components/context/context-composer";
import { ContextSourcesPanel } from "@web/components/context/context-sources-panel";
import { useContextSources } from "@web/components/context/use-context-sources";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchTargetFields } from "@web/components/runs/launch/launch-target-fields";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import { contextRequestFields, EMPTY_CONTEXT_DRAFT } from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { submitOnCmdEnter } from "@web/lib/form";
import { useState } from "react";

export interface SingleRunLaunchFormProps {
  issue: IssueContract;
  target: Extract<LaunchTargetState, { status: "ready" }>;
  execution: ExecutionSelection;
  onExecutionChange: (execution: ExecutionSelection) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

/** One agent turn on this issue: the issue is attached, and the only text is the instruction the user chooses to add. */
export function SingleRunLaunchForm({
  issue,
  target,
  execution,
  onExecutionChange,
  onLaunched,
  onCancel,
}: SingleRunLaunchFormProps) {
  const [context, setContext] = useState(EMPTY_CONTEXT_DRAFT);
  const launchExecution = useLaunchExecution(execution);
  const { launch, isPending } = useLaunchRun();
  const sources = useContextSources({
    draft: context,
    issue,
    agentChoice: launchExecution.selection.agent,
    profiles: launchExecution.agents.profiles,
  });
  const canSubmit = launchExecution.canLaunch && !isPending;

  async function submit() {
    if (!canSubmit) return;
    const run = await launch({
      issue_id: issue.id,
      base_branch: target.baseBranch,
      ...contextRequestFields(context),
      ...launchExecution.request,
    });
    if (run) onLaunched(run);
  }

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-3" onKeyDown={submitOnCmdEnter(() => void submit())}>
          <ContextComposer
            autoFocus
            issue={issue}
            projectId={issue.project_id}
            value={context}
            onChange={setContext}
            label="Single run"
            noteRows={4}
          />
          <ContextSourcesPanel sources={sources} />
          <LaunchExecutionPicker
            execution={launchExecution}
            onChange={onExecutionChange}
            label="Single run"
          />
          <LaunchTargetFields target={target} disabled={isPending} />
        </div>
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
