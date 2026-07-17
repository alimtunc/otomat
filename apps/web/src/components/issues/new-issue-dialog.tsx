import { FAKE_RUNTIME_ID } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Icon,
  Kbd,
  Textarea,
} from "@otomat/ui";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import { useState, type KeyboardEvent } from "react";

export interface NewIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
}

export function NewIssueDialog({ open, onOpenChange, projectName }: NewIssueDialogProps) {
  const [promptText, setPromptText] = useState("");
  const [runtime, setRuntime] = useState<string>(FAKE_RUNTIME_ID);
  const { start, isPending } = useStartRunAndNavigate();

  const canSubmit = promptText.trim().length > 0 && !isPending;

  async function submit() {
    if (!canSubmit) return;
    const started = await start({ prompt: promptText.trim(), runtime });
    if (started) {
      onOpenChange(false);
      setPromptText("");
    }
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="New issue">
        <DialogHeader>
          <div className="flex items-center gap-1.75 text-sm text-text-secondary">
            {projectName ? (
              <>
                <b className="font-semibold text-foreground">{projectName}</b>
                <Icon
                  name="chevron-down"
                  aria-hidden
                  className="h-3.25 w-3.25 -rotate-90 text-text-tertiary"
                />
              </>
            ) : null}
            <span>Create with agent</span>
          </div>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            onKeyDown={onPromptKeyDown}
            placeholder='Tell the agent what to do, e.g. "implement nested CSV quoting in the parser and open a PR"'
            rows={4}
            aria-label="Issue prompt"
          />
          <RuntimeSelect value={runtime} onValueChange={setRuntime} />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
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
      </DialogContent>
    </Dialog>
  );
}
