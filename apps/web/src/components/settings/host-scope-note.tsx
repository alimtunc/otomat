import { Icon } from "@otomat/ui";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { describeRemoteStatus } from "@web/components/shell/remote-session/status-labels";
import { useActiveHostLabel } from "@web/lib/active-host";

export function HostScopeNote() {
  const hostLabel = useActiveHostLabel();
  const session = useRemoteSession();
  const unreachable =
    session.active && session.status?.phase === "error"
      ? describeRemoteStatus(session.status)
      : null;

  return (
    <div className="mb-5 flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text-tertiary">
      <Icon
        name={session.active ? "terminal" : "monitor"}
        aria-hidden
        className="mt-px h-3.5 w-3.5 flex-none"
      />
      <div>
        <p>
          Kept by the <span className="font-medium text-text-secondary">{hostLabel}</span> daemon
          {session.active ? " over SSH" : " on this machine"}; every other host keeps its own.
        </p>
        {unreachable === null ? null : (
          <p role="alert" className="mt-1 text-danger">
            {hostLabel} is not answering, so nothing here can be created, changed or deleted until
            it reconnects: {unreachable}
          </p>
        )}
      </div>
    </div>
  );
}
