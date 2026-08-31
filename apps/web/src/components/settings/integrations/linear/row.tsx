import type { LinearConnectionContract, LinearConnectionStatus } from "@otomat/domain";
import { Button, toast } from "@otomat/ui";
import { useProjects } from "@web/api/daemon/queries";
import { linearErrorMessage, useDisconnectLinear } from "@web/api/linear/mutations";
import { useIssueSources } from "@web/api/linear/queries";
import { LinearConnectForm } from "@web/components/settings/integrations/linear/connect-form";
import { ConnectionDelivery } from "@web/components/settings/integrations/linear/delivery";
import { DisconnectLinearDialog } from "@web/components/settings/integrations/linear/disconnect-dialog";
import { connectionProjects } from "@web/components/settings/integrations/linear/projects";
import { useState } from "react";

const STATUS = {
  connected: { label: "Connected", tone: "text-text-secondary" },
  disconnected: { label: "Key not on this host", tone: "text-text-tertiary" },
  failed: { label: "Access refused", tone: "text-danger" },
} satisfies Record<LinearConnectionStatus, { label: string; tone: string }>;

export function LinearConnectionRow({ connection }: { connection: LinearConnectionContract }) {
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
          <p className={`truncate text-xs ${STATUS[connection.status].tone}`}>
            {connection.error_message ?? STATUS[connection.status].label}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReconnecting((open) => !open)}
          >
            {reconnecting ? "Cancel" : "Reconnect"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
            Disconnect
          </Button>
        </div>
      </div>

      {reconnecting ? (
        <div className="border-t border-border-subtle px-3 py-2.5">
          <LinearConnectForm connection={connection} onConnected={() => setReconnecting(false)} />
        </div>
      ) : null}

      <ConnectionDelivery connectionId={connection.id} />

      <DisconnectLinearDialog
        connection={connection}
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
