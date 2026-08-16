import type { ExecutionHostDescriptor, RemoteHostStatus } from "@otomat/domain";
import { Badge, Icon } from "@otomat/ui";
import { describeRemoteStatus } from "@web/components/shell/remote-session/status-labels";
import type { ReactNode } from "react";

const STATUS_TONES: Partial<Record<RemoteHostStatus["phase"], string>> = {
  connected: "text-text-secondary",
  error: "text-danger",
};

function RemoteStatusLine({ status }: { status: RemoteHostStatus | null }) {
  if (status === null) return null;
  const tone = STATUS_TONES[status.phase] ?? "text-text-tertiary";
  return (
    <p role="status" className={`text-xs ${tone}`}>
      {describeRemoteStatus(status)}
    </p>
  );
}

export interface HostRowProps {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  action?: ReactNode;
}

export function HostRow({ host, active, status, action }: HostRowProps) {
  return (
    <div className="flex items-start gap-3 p-4">
      <Icon
        name={host.kind === "ssh" ? "terminal" : "monitor"}
        aria-hidden
        className="mt-0.5 h-4 w-4 text-text-tertiary"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{host.label}</span>
          <span className="text-xs text-text-tertiary">
            {host.kind === "ssh" ? "SSH tunnel · daemon on the host" : "This machine"}
          </span>
          {active ? <Badge>Active</Badge> : null}
        </div>
        {host.kind === "ssh" ? <RemoteStatusLine status={status} /> : null}
      </div>
      {action}
    </div>
  );
}
