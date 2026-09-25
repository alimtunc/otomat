import { useSelector } from "@tanstack/react-store";
import { activeHost, activeHostStore, useActiveHostDescriptor } from "@web/lib/active-host";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { previewSession } from "@web/preview/session";

import { TerminalPanel } from "./panel";

export function TerminalWorkspace(
  props: { issueId: string; runId?: string | null } | { projectId: string },
) {
  const targetKey =
    "issueId" in props
      ? `issue:${props.issueId}:${props.runId ?? ""}`
      : `project:${props.projectId}`;
  const host = useActiveHostDescriptor();
  const url = useSelector(activeHostStore, (state) => state?.daemonUrl ?? activeHost().daemonUrl);
  if (desktopBridge() === null || previewSession() !== null)
    return (
      <p className="p-4 text-sm text-text-secondary">
        User terminals are available in the desktop app.
      </p>
    );
  return (
    <TerminalPanel
      key={`${url}:${targetKey}`}
      {...("issueId" in props ? { issueId: props.issueId, runId: props.runId ?? null } : props)}
      host={host}
    />
  );
}
