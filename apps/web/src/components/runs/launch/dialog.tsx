import { FAKE_RUNTIME_ID } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icon,
  Textarea,
} from "@otomat/ui";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { RuntimeSelect } from "@web/components/runs/launch/runtime-select";
import { useState } from "react";

export function StartRunDialog() {
  const [open, setOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [runtime, setRuntime] = useState<string>(FAKE_RUNTIME_ID);
  const { start, isPending } = useStartRunAndNavigate();

  const canSubmit = promptText.trim().length > 0 && !isPending;

  async function submit() {
    const started = await start({ prompt: promptText.trim(), runtime });
    if (started) {
      setOpen(false);
      setPromptText("");
    }
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Icon name="play" aria-hidden />
        New local run
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a local run</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <DialogDescription>
              Launches the selected runtime against a new local issue and streams its events live.
            </DialogDescription>
            <Textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              placeholder="Describe what the agent should do…"
              rows={4}
              aria-label="Run prompt"
            />
            <RuntimeSelect value={runtime} onValueChange={setRuntime} />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isPending}
              disabled={!canSubmit}
              onClick={submit}
            >
              Start run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
