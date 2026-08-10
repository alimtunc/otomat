import type { ModelSelection, RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd, Textarea } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/use-launch-run";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import { LaunchTargetFields } from "@web/components/runs/launch/launch-target-fields";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import type { LaunchTargetState } from "@web/components/runs/launch/use-launch-target";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { isCompleteModelSelection } from "@web/lib/model-choice";
import { useState, type KeyboardEvent } from "react";

export interface AgentIssueFormProps {
  target: Extract<LaunchTargetState, { status: "ready" }>;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

export function AgentIssueForm({
  target,
  agentChoice,
  onAgentChoice,
  onLaunched,
  onCancel,
}: AgentIssueFormProps) {
  const [promptText, setPromptText] = useState("");
  const [model, setModel] = useState<ModelSelection | undefined>(undefined);
  const { launch, isPending } = useLaunchRun();
  const agents = useLaunchAgentChoice(agentChoice);
  const choice = agents.choice;

  const canSubmit =
    promptText.trim().length > 0 &&
    choice !== null &&
    isCompleteModelSelection(model) &&
    !isPending;

  async function submit() {
    if (!canSubmit || choice === null) return;
    const run = await launch({
      prompt: promptText.trim(),
      project_id: target.repository.project_id,
      base_branch: target.baseBranch,
      ...agentChoiceToRequest(choice),
      model,
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
