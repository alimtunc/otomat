import type { IssueContract, ModelSelection, RunContract } from "@otomat/domain";
import { Button, DialogBody, Field, FieldControl, FieldLabel, Kbd, Textarea } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/mutations";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import { LaunchTargetFields } from "@web/components/runs/launch/launch-target-fields";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { hasText, submitOnCmdEnter } from "@web/lib/form";
import { issueLaunchPrompt } from "@web/lib/issue-prompt";
import { isCompleteModelSelection } from "@web/lib/model-choice";
import { useState } from "react";

export interface SingleRunLaunchFormProps {
  issue: IssueContract;
  target: Extract<LaunchTargetState, { status: "ready" }>;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

/** One agent turn on this issue, with the prompt it starts from on screen and editable. */
export function SingleRunLaunchForm({
  issue,
  target,
  agentChoice,
  onAgentChoice,
  onLaunched,
  onCancel,
}: SingleRunLaunchFormProps) {
  const [prompt, setPrompt] = useState(() => issueLaunchPrompt(issue));
  const [model, setModel] = useState<ModelSelection | undefined>(undefined);
  const agents = useLaunchAgentChoice(agentChoice);
  const { launch, isPending } = useLaunchRun();
  const canSubmit =
    hasText(prompt) && agents.choice !== null && isCompleteModelSelection(model) && !isPending;

  async function submit() {
    if (!canSubmit || agents.choice === null) return;
    const run = await launch({
      issue_id: issue.id,
      prompt: prompt.trim(),
      base_branch: target.baseBranch,
      ...agentChoiceToRequest(agents.choice),
      model,
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
        <LaunchAgentModelFields
          agents={agents}
          model={model}
          onAgentChoice={onAgentChoice}
          onModelChange={setModel}
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
