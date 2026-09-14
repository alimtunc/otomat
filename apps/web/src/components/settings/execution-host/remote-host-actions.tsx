import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
} from "@otomat/ui";
import { useRef, useState } from "react";

export interface RemoteHostActionsProps {
  pending: boolean;
  error: string | null;
  onRemove: () => Promise<boolean>;
}

export function RemoteHostActions({ pending, error, onRemove }: RemoteHostActionsProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          render={<IconButton label="Remote host actions" icon={<Icon name="more-horizontal" />} />}
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setConfirming(true)}>Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent finalFocus={trigger}>
          <DialogHeader>
            <DialogTitle>Remove host</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-text-secondary">
              Removing the host closes the tunnel and forgets the SSH alias. Its projects leave the
              switcher. Nothing is deleted on the server; adding the alias again brings them back.
            </p>
            {error === null ? null : (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              disabled={pending}
              onClick={() =>
                void onRemove().then((removed) => {
                  if (removed) setConfirming(false);
                })
              }
            >
              Remove host
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
