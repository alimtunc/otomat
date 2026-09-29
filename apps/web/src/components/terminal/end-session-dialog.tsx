import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogContentProps,
} from "@otomat/ui";
import { captureTerminalClient } from "@web/api/terminals/client";
import { useCloseTerminal } from "@web/api/terminals/mutations";
import { useTerminalInventory } from "@web/api/terminals/queries";
import { useState } from "react";

import { terminalError } from "./error";

export function EndSessionDialog({
  sessionId,
  finalFocus,
  onClose,
}: {
  sessionId: string;
  finalFocus?: DialogContentProps["finalFocus"];
  onClose: () => void;
}) {
  const [client] = useState(captureTerminalClient);
  const inventory = useTerminalInventory(client);
  const close = useCloseTerminal(client);
  const instance = inventory.data?.instance ?? null;
  const failure = close.error ?? (inventory.data === undefined ? inventory.error : null);
  let notice: string | null = null;
  if (failure) notice = terminalError(failure);
  else if (inventory.data?.instance === null)
    notice = "Integrated terminal unavailable on this host.";
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !close.isPending) onClose();
      }}
    >
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader className="flex-col items-start gap-1.5 pr-10">
          <DialogTitle>End this session?</DialogTitle>
          <DialogDescription>
            This stops the shell and interrupts any command still running. Your worktree and saved
            files stay in place.
          </DialogDescription>
        </DialogHeader>
        {notice === null ? null : (
          <DialogBody>
            <p role="alert" className="text-sm text-danger">
              {notice}
            </p>
          </DialogBody>
        )}
        <DialogFooter className="justify-end">
          <Button variant="ghost" disabled={close.isPending} onClick={onClose}>
            Keep working
          </Button>
          <Button
            variant="destructive"
            loading={close.isPending || inventory.isPending}
            disabled={instance === null}
            onClick={() => {
              if (instance !== null)
                close.mutate({ id: sessionId, instance }, { onSuccess: onClose });
            }}
          >
            End session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
