import type { ErrorDiagnostic } from "@otomat/domain";
import {
  Button,
  CopyButton,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@otomat/ui";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { problemReportDraft } from "@web/lib/diagnostics/report-draft";

export interface ReportProblemDialogProps {
  diagnostic: ErrorDiagnostic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PREVIEW_CLASS =
  "max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle " +
  "bg-background p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary";

export function ReportProblemDialog({ diagnostic, open, onOpenChange }: ReportProblemDialogProps) {
  const draft = problemReportDraft(diagnostic);
  const preview = `${draft.title}\n\n${draft.body}`;

  async function openDraft() {
    const bridge = desktopBridge();
    if (bridge === null) {
      toast.error("Opening a draft needs the desktop app. Copy the report and paste it instead.");
      return;
    }
    try {
      await bridge.support.openReportDraft(draft);
      onOpenChange(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      toast.error(`The report draft could not be opened: ${detail}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Report a problem">
        <DialogHeader>
          <DialogTitle>Report this problem</DialogTitle>
          <DialogDescription>
            Nothing has been sent. This is exactly what a report would contain; opening the draft
            puts it in your browser, where you can edit or discard it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <pre className={PREVIEW_CLASS}>{preview}</pre>
        </DialogBody>
        <DialogFooter>
          <CopyButton value={preview} label="Copy report" copiedLabel="Report copied" showLabel />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => void openDraft()}>
            Open draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
