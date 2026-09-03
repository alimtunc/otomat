import type { ExecutionHostDescriptor, ExecutionHostId } from "@otomat/domain";
import { createStore, useSelector } from "@tanstack/react-store";
import { desktopBridge } from "@web/lib/desktop-bridge";

export interface ActiveHost {
  id: ExecutionHostId;
  /** Origin the daemon client targets; empty outside the desktop shell, where the build-time URL applies. */
  daemonUrl: string;
}

function noSwitchYet(): ActiveHost | null {
  return null;
}

/** Only a switch writes here; the bridge is read at call time so a load-time host never gets captured. */
export const activeHostStore = createStore(noSwitchYet(), ({ setState }) => ({
  activate(host: ActiveHost): void {
    setState(() => host);
  },
}));

function resolve(switched: ActiveHost | null): ActiveHost {
  if (switched !== null) return switched;
  const bridge = desktopBridge();
  return { id: bridge?.executionHostId ?? "local", daemonUrl: bridge?.daemonUrl ?? "" };
}

export function activeHost(): ActiveHost {
  return resolve(activeHostStore.state);
}

export function activeExecutionHostId(): ExecutionHostId {
  return activeHost().id;
}

export function remoteHostAlias(hostId: ExecutionHostId = activeExecutionHostId()): string | null {
  const bridge = desktopBridge();
  return bridge !== null && hostId === "remote" ? bridge.executionHostSshAlias : null;
}

export function useActiveHostId(): ExecutionHostId {
  return useSelector(activeHostStore, (switched) => resolve(switched).id);
}

export function useRemoteHostAlias(): string | null {
  return remoteHostAlias(useActiveHostId());
}

/** Not a hook, so a refusal composed outside React still names the host that did not answer. */
export function activeHostLabel(hostId: ExecutionHostId = activeExecutionHostId()): string {
  return hostId === "remote" ? (remoteHostAlias(hostId) ?? "Remote host") : "Local";
}

export function useActiveHostLabel(): string {
  return activeHostLabel(useActiveHostId());
}

export function useActiveHostDescriptor(): ExecutionHostDescriptor {
  const id = useActiveHostId();
  return { id, label: activeHostLabel(id), kind: id === "local" ? "local" : "ssh" };
}
