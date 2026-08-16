import { contextReferenceKey, type RunContract } from "@otomat/domain";
import { AutoTextarea, DialogBody, Icon, IconButton } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { AddContextPopover } from "@web/components/context/add-context-popover";
import { AttachedContextRow } from "@web/components/context/attached-context-row";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import { useLaunchExecution } from "@web/components/execution/use-launch-execution";
import { ComposerShell } from "@web/components/issues/composer-shell";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { BaseBranchControl } from "@web/components/runs/launch/base-branch-control";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import {
  addContextReference,
  contextRequestFields,
  EMPTY_CONTEXT_DRAFT,
  removeContextReference,
} from "@web/lib/context/draft";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { useState, type KeyboardEvent } from "react";

const COMPOSER_LABEL = "Ad-hoc run";
const LAUNCH_ACTION = "Create & launch";

/** Icon-only: the accessible name is the only thing left to say why the action is unavailable. */
function launchLabel(pending: boolean, hasPrompt: boolean, canLaunch: boolean): string {
  if (pending) return `${LAUNCH_ACTION} — creating the issue and launching the run`;
  if (!hasPrompt) return `${LAUNCH_ACTION} — write a prompt first`;
  if (!canLaunch) return `${LAUNCH_ACTION} — choose an available agent and model`;
  return LAUNCH_ACTION;
}

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
  const [context, setContext] = useState(EMPTY_CONTEXT_DRAFT);
  const { launch, isPending } = useLaunchRun();
  const launchExecution = useLaunchExecution(execution);

  const hasPrompt = promptText.trim().length > 0;
  const canSubmit = hasPrompt && launchExecution.canLaunch && !isPending;
  const launchName = launchLabel(isPending, hasPrompt, launchExecution.canLaunch);

  async function submit() {
    if (!canSubmit) return;
    const run = await launch({
      prompt: promptText.trim(),
      project_id: target.repository.project_id,
      base_branch: target.baseBranch,
      ...contextRequestFields(context),
      ...launchExecution.request,
    });
    if (run) {
      setPromptText("");
      setContext(EMPTY_CONTEXT_DRAFT);
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
      <DialogBody>
        <ComposerShell
          controls={
            <>
              <LaunchExecutionPicker
                execution={launchExecution}
                onChange={onExecutionChange}
                label={COMPOSER_LABEL}
              />
              <AttachedContextRow
                issue={null}
                references={context.references}
                onRemove={(key) => setContext(removeContextReference(context, key))}
                label={COMPOSER_LABEL}
                addControl={
                  <AddContextPopover
                    projectId={target.repository.project_id}
                    repositoryId={target.repository.id}
                    attachedKeys={new Set(context.references.map(contextReferenceKey))}
                    onAdd={(reference) => setContext(addContextReference(context, reference))}
                    label={COMPOSER_LABEL}
                  />
                }
              />
              <BaseBranchControl target={target} disabled={isPending} />
            </>
          }
          submit={
            <IconButton
              variant="primary"
              label={launchName}
              title={`${launchName} · ⌘↵`}
              icon={<Icon name="play" aria-hidden />}
              loading={isPending}
              disabled={!canSubmit}
              onClick={() => void submit()}
            />
          }
        >
          <AutoTextarea
            autoFocus
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            onKeyDown={onPromptKeyDown}
            placeholder='Tell the agent what to do, e.g. "implement nested CSV quoting in the parser and open a PR"'
            aria-label="Issue prompt"
          />
        </ComposerShell>
      </DialogBody>
      <IssueFormFooter onCancel={onCancel} />
    </>
  );
}
