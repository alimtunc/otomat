import { Button, DialogBody, DialogFooter, EmptyState, Kbd, Textarea } from "@otomat/ui";
import { useRuntimes } from "@web/api/daemon/queries";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import { hasLaunchableRuntime, resolveRuntimeChoice } from "@web/lib/runtimes";
import { useState, type KeyboardEvent } from "react";

export interface AgentIssueFormProps {
  runtimeChoice: string | null;
  onRuntimeChoice: (runtime: string) => void;
  onLaunched: () => void;
  onCancel: () => void;
}

export function AgentIssueForm({
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

  const canSubmit = promptText.trim().length > 0 && runtime !== null && !isPending;

  async function submit() {
    if (!canSubmit || runtime === null) return;
    const started = await start({ prompt: promptText.trim(), runtime });
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

  let runtimePicker = (
    <RuntimeSelect
      descriptors={descriptors}
      value={runtime}
      onValueChange={onRuntimeChoice}
      disabled={runtimes.isPending}
    />
  );
  if (runtimes.isError) {
    runtimePicker = (
      <EmptyState
        variant="compact"
        tone="error"
        icon="alert-triangle"
        title="Couldn’t load runtimes"
        description="The daemon didn’t return its runtime list, so a run can’t be launched."
        action={
          <Button variant="outline" size="xs" onClick={() => void runtimes.refetch()}>
            Retry
          </Button>
        }
      />
    );
  } else if (runtimes.isSuccess && !hasLaunchableRuntime(descriptors)) {
    runtimePicker = (
      <EmptyState
        variant="compact"
        icon="bot"
        title="No agent runtime available"
        description="Install Claude Code (npm install -g @anthropic-ai/claude-code) or Codex CLI (npm install -g @openai/codex), then check again."
        action={
          <Button variant="outline" size="xs" onClick={() => void runtimes.refetch()}>
            Check again
          </Button>
        }
      />
    );
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
        {runtimePicker}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
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
      </DialogFooter>
    </>
  );
}
