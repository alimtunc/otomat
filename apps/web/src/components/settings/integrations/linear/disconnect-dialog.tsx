import type { LinearConnectionContract, ProjectContract } from "@otomat/domain";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@otomat/ui";

export interface DisconnectLinearDialogProps {
  connection: LinearConnectionContract;
  /** The projects whose Linear mappings this disconnection removes. */
  affected: ProjectContract[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DisconnectLinearDialog({
  connection,
  affected,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DisconnectLinearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label={`Disconnect ${connection.label}`}>
        <DialogHeader>
          <DialogTitle>Disconnect {connection.label}</DialogTitle>
          <DialogDescription>
            The key is erased from this machine and revoked on every execution host. Issues already
            imported stay; nothing is deleted on Linear.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {affected.length === 0 ? (
            <p className="text-xs text-text-tertiary">No project maps this connection.</p>
          ) : (
            <>
              <p className="text-xs text-text-secondary">
                These projects lose their Linear team mapping and stop syncing:
              </p>
              <ul className="flex flex-col gap-1">
                {affected.map((project) => (
                  <li key={project.id} className="truncate text-sm text-foreground">
                    {project.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            loading={isPending}
            disabled={isPending}
            onClick={onConfirm}
          >
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
