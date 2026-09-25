import type { DaemonClient } from "@otomat/client";
import type { TerminalSession } from "@otomat/domain";
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
  IconButton,
} from "@otomat/ui";
import { useCloseTerminal } from "@web/api/terminals/mutations";
import { useState } from "react";

import { terminalError } from "./error";

export function EndSessionDialog({
  client,
  instance,
  session,
  disabled,
}: {
  client: DaemonClient;
  instance: string;
  session: TerminalSession;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCloseTerminal(client);
  return (
    <>
      <IconButton
        label="End session"
        icon={<Icon name="square" aria-hidden />}
        disabled={disabled || close.isPending || session.state === "closing"}
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!close.isPending) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader className="flex-col items-start gap-1.5 pr-10">
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              This stops the shell and its active command. Your worktree and saved files stay in
              place.
            </DialogDescription>
          </DialogHeader>
          {close.error ? (
            <DialogBody>
              <p role="alert" className="text-sm text-danger">
                {terminalError(close.error)}
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter className="justify-end">
            <Button variant="ghost" disabled={close.isPending} onClick={() => setOpen(false)}>
              Keep working
            </Button>
            <Button
              variant="destructive"
              loading={close.isPending}
              disabled={close.isPending}
              onClick={() =>
                close.mutate({ id: session.id, instance }, { onSuccess: () => setOpen(false) })
              }
            >
              End session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
