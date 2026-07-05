import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@otomat/ui";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { Play } from "lucide-react";
import { useState } from "react";

export function StartRunDialog() {
  const [open, setOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const { start, isPending } = useStartRunAndNavigate();

  const canSubmit = promptText.trim().length > 0 && !isPending;

  async function submit() {
    const started = await start({ prompt: promptText.trim() });
    if (started) {
      setOpen(false);
      setPromptText("");
    }
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Play aria-hidden />
        New local run
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a local run</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <DialogDescription>
              Launches the fake runtime against a new local issue and streams its events live.
            </DialogDescription>
            <Textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              placeholder="Describe what the agent should do…"
              rows={4}
              aria-label="Run prompt"
            />
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
