import type { ExecutionHostId, RemoteHostStatus } from "@otomat/domain";

import type { RemoteSessionHandle } from "../session.js";

export type ResolvedDaemonUrl = { url: string } | { message: string };

export interface CommandUrlOptions {
  localDaemonUrl(): string;
  remoteSshAlias(): string | null;
  remoteSession(): RemoteSessionHandle | null;
  warmRemote(): Promise<RemoteHostStatus | null>;
}

export async function resolveCommandBaseUrl(
  options: CommandUrlOptions,
  hostId: ExecutionHostId,
): Promise<ResolvedDaemonUrl> {
  if (hostId === "local") {
    const url = options.localDaemonUrl();
    return url === "" ? { message: "The local daemon is not running yet." } : { url };
  }
  if (options.remoteSshAlias() === null) return { message: "No remote host is configured." };
  await options.warmRemote();
  const session = options.remoteSession();
  if (session?.status.phase === "connected" && session.url !== null) return { url: session.url };
  return { message: "The remote host is not connected yet. Try again once its tunnel is up." };
}
