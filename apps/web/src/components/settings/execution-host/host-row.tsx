import type { ExecutionHostDescriptor, RemoteHostStatus } from "@otomat/domain";
import { Icon } from "@otomat/ui";
import {
  describeRemoteStatus,
  remoteStatusHeadline,
} from "@web/components/shell/remote-session/status-labels";
import type { ReactNode } from "react";

export interface HostRowProps {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  action?: ReactNode;
}

export function HostRow({ host, active, status, action }: HostRowProps) {
  let label = active ? "Active" : "Local";
  if (host.kind === "ssh")
    label = status === null ? "Status unreported" : remoteStatusHeadline(status, host.label);
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon
        name={host.kind === "ssh" ? "terminal" : "monitor"}
        aria-hidden
        className="mt-0.5 size-4 text-text-tertiary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{host.label}</span>
          <span className="text-xs text-text-tertiary">{label}</span>
        </div>
        {host.kind === "ssh" &&
        status !== null &&
        (status.phase === "error" || (status.phase !== "connected" && status.detail !== null)) ? (
          <p
            role={status.phase === "error" ? "alert" : undefined}
            className={
              status.phase === "error" ? "text-xs text-danger" : "text-xs text-text-secondary"
            }
          >
            {describeRemoteStatus(status)}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
