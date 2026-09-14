import type { LinearConnectionContract, LinearConnectionStatus } from "@otomat/domain";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  toast,
} from "@otomat/ui";
import { useProjects } from "@web/api/daemon/queries";
import { linearErrorMessage, useDisconnectLinear } from "@web/api/linear/mutations";
import { useIssueSources } from "@web/api/linear/queries";
import { LinearConnectForm } from "@web/components/settings/integrations/linear/connect-form";
import { ConnectionDelivery } from "@web/components/settings/integrations/linear/delivery";
import { DisconnectLinearDialog } from "@web/components/settings/integrations/linear/disconnect-dialog";
import { connectionProjects } from "@web/components/settings/integrations/linear/projects";
import { useRef, useState } from "react";

const STATUS = {
  connected: { label: "Connected", tone: "text-text-secondary" },
  disconnected: { label: "Key not on this host", tone: "text-text-tertiary" },
  failed: { label: "Access refused", tone: "text-danger" },
} satisfies Record<LinearConnectionStatus, { label: string; tone: string }>;

export function LinearConnectionRow({ connection }: { connection: LinearConnectionContract }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const disconnect = useDisconnectLinear();
  const projects = useProjects();
  const sources = useIssueSources();
  const [reconnecting, setReconnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const affected = connectionProjects(connection.id, sources.data ?? [], projects.data ?? []);

  return (
    <li className="flex flex-col rounded-lg border border-border-subtle bg-card">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{connection.label}</p>
          <p className="truncate text-xs text-text-tertiary">
            {connection.workspace_name === ""
              ? "Never authenticated"
              : `${connection.workspace_name} · ${connection.user_name}`}
          </p>
          {connection.status !== "connected" || connection.error_message !== null ? (
            <p
              role={connection.error_message === null ? undefined : "alert"}
              className={`text-xs ${STATUS[connection.status].tone}`}
            >
              {connection.error_message ?? STATUS[connection.status].label}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={trigger}
            render={
              <IconButton
                label={`Actions for ${connection.label}`}
                icon={<Icon name="more-horizontal" />}
              />
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setReconnecting(true)}>Reconnect</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirming(true)}>Disconnect</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={reconnecting} onOpenChange={setReconnecting}>
        <DialogContent finalFocus={trigger}>
          <DialogHeader>
            <DialogTitle>Reconnect {connection.label}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <LinearConnectForm connection={connection} onConnected={() => setReconnecting(false)} />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConnectionDelivery connectionId={connection.id} />

      <DisconnectLinearDialog
        connection={connection}
        finalFocus={trigger}
        error={disconnect.isError ? linearErrorMessage(disconnect.error) : null}
        affected={affected}
        open={confirming}
        onOpenChange={setConfirming}
        isPending={disconnect.isPending}
        onConfirm={() => {
          disconnect.mutate(connection.id, {
            onSuccess: () => {
              setConfirming(false);
              toast.success(`Disconnected ${connection.label}`);
            },
            onError: (error) => toast.error(linearErrorMessage(error)),
          });
        }}
      />
    </li>
  );
}
