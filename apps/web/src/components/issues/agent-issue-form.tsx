import { Button, DialogBody, Kbd, Textarea } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { IssueFormFooter } from "@web/components/issues/issue-form-footer";
import { RuntimePicker } from "@web/components/runs/launch/runtime-picker";
import { resolveRuntimeChoice } from "@web/lib/runtimes";
import { useState, type KeyboardEvent } from "react";

export interface AgentIssueFormProps {
  projectId: string | undefined;
  runtimeChoice: string | null;
  onRuntimeChoice: (runtime: string) => void;
  onLaunched: () => void;
  onCancel: () => void;
}

export function AgentIssueForm({
  projectId,
  runtimeChoice,
  onRuntimeChoice,
  onLaunched,
  onCancel,
}: AgentIssueFormProps) {
  const [promptText, setPromptText] = useState("");
  const { start, isPending } = useStartRunAndNavigate();
  const runtimes = useRuntimes();
  const descriptors = runtimes.data ?? [];
  const runtime = resolveRuntimeChoice(descriptors, runtimeChoice);

  const canSubmit =
    promptText.trim().length > 0 && runtime !== null && projectId !== undefined && !isPending;

  async function submit() {
    if (!canSubmit || runtime === null || projectId === undefined) return;
    const started = await start({ prompt: promptText.trim(), runtime, project_id: projectId });
    if (started) {
      setPromptText("");
      onLaunched();
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
        <RuntimePicker
          descriptors={descriptors}
          value={runtime}
          onValueChange={onRuntimeChoice}
          isPending={runtimes.isPending}
          isError={runtimes.isError}
          isSuccess={runtimes.isSuccess}
          onRetry={() => void runtimes.refetch()}
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
            <Kbd className="border-[rgba(255,255,255,.4)] text-on-accent">⌘↵</Kbd>
          </Button>
        }
      />
    </>
  );
}
