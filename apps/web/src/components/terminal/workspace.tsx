import { useSelector } from "@tanstack/react-store";
import { userTerminalsAvailable } from "@web/api/terminals/client";
import { useDaemonToken } from "@web/api/use-daemon-token";
import { activeHost, activeHostStore, useActiveHostDescriptor } from "@web/lib/active-host";

import { TerminalPanel } from "./panel";

export function TerminalWorkspace(
  props: { issueId: string; runId: string | null } | { projectId: string; rootPath: string },
) {
  const targetKey =
    "issueId" in props
      ? `issue:${props.issueId}:${props.runId ?? ""}`
      : `project:${props.projectId}`;
  const host = useActiveHostDescriptor();
  const url = useSelector(activeHostStore, (state) => state?.daemonUrl ?? activeHost().daemonUrl);
  const token = useDaemonToken();
  if (!userTerminalsAvailable())
    return (
      <p className="p-4 text-sm text-text-secondary">
        User terminals are available in the desktop app.
      </p>
    );
  return <TerminalPanel key={`${url}:${token}:${targetKey}`} {...props} host={host} />;
}
