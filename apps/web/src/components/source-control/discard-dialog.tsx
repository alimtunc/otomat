import type { ChangeFilesRequest } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";

export interface DiscardDialogProps {
  request: ChangeFilesRequest | null;
  onClose: () => void;
  onConfirm: (request: ChangeFilesRequest) => void;
}

export function DiscardDialog({ request, onClose, onConfirm }: DiscardDialogProps) {
  let title = "Discard file changes?";
  if (request?.all) title = "Discard all unstaged changes?";
  else if (request?.selection) title = "Discard selected changes?";
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader className="flex-col items-start gap-2 pr-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {request?.all
              ? "All unstaged changes in this checkout will be permanently lost, including untracked files."
              : `The ${request?.selection ? "selected" : "unstaged"} changes in ${request?.path ?? "this file"} will be permanently lost. An untracked file will be deleted.`}{" "}
            Staged changes are kept. This action is irreversible and cannot be undone in Otomat.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (request !== null) onConfirm(request);
            }}
          >
            {request?.all ? "Discard all changes" : "Discard changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
