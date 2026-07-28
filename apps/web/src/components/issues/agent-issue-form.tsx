import type { ModelSelection, RunContract } from "@otomat/domain";
import { Button, DialogBody, Kbd, Textarea } from "@otomat/ui";
import { useLaunchRun } from "@web/api/runs/mutations";
import { IssueFormFooter } from "@web/components/issues/issue/form-footer";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import { useLaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceToRequest } from "@web/lib/agent-choice";
import { isCompleteModelSelection } from "@web/lib/model-choice";
import { useState, type KeyboardEvent } from "react";

export interface AgentIssueFormProps {
  projectId: string | undefined;
  agentChoice: string | null;
  onAgentChoice: (choice: string | null) => void;
  onLaunched: (run: RunContract) => void;
  onCancel: () => void;
}

export function AgentIssueForm({
  projectId,
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
    projectId !== undefined &&
    isCompleteModelSelection(model) &&
    !isPending;

  async function submit() {
    if (!canSubmit || choice === null || projectId === undefined) return;
    const run = await launch({
      prompt: promptText.trim(),
      project_id: projectId,
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
        {projectId === undefined ? (
          <p className="text-xs text-danger">Select a project before launching a run.</p>
        ) : null}
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
