import type { DaemonEndpoint } from "@otomat/client";
import type { ExecutionHostId, RemoteHostStatus } from "@otomat/domain";

import type { RemoteSessionHandle } from "../session.js";

export type ResolvedDaemonEndpoint = DaemonEndpoint | { message: string };

export interface CommandEndpointOptions {
  localDaemon(): DaemonEndpoint | null;
  remoteSshAlias(): string | null;
  remoteSession(): RemoteSessionHandle | null;
  warmRemote(): Promise<RemoteHostStatus | null>;
}

export function currentEndpoint(
  options: CommandEndpointOptions,
  hostId: ExecutionHostId,
): ResolvedDaemonEndpoint {
  if (hostId === "local") {
    return options.localDaemon() ?? { message: "The local daemon is not running yet." };
  }
  if (options.remoteSshAlias() === null) return { message: "No remote host is configured." };
  return (
    options.remoteSession()?.endpoint ?? {
      message: "The remote host is not connected yet. Try again once its tunnel is up.",
    }
  );
}

export async function resolveCommandEndpoint(
  options: CommandEndpointOptions,
  hostId: ExecutionHostId,
): Promise<ResolvedDaemonEndpoint> {
  if (hostId === "remote" && options.remoteSshAlias() !== null) await options.warmRemote();
  return currentEndpoint(options, hostId);
}
