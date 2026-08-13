import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";

export interface ViewDeleteDialogProps {
  name: string;
  /** True when the screen also carries changes this view never saved, which the delete drops too. */
  dirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ViewDeleteDialog({
  name,
  dirty,
  open,
  onOpenChange,
  onConfirm,
}: ViewDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={`Delete ${name}`} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>
            {dirty
              ? "This view has unsaved changes. Deleting it drops both the saved configuration and those changes. No issue or run is affected."
              : "This removes the saved grouping, filters and sort. No issue or run is affected."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Delete view
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
