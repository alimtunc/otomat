import type { RemoteRepositoryEntry } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { desktopBridge } from "@web/lib/desktop-bridge";

export interface UseRemoteRepositoriesResult {
  /** Undefined while the host is still answering. */
  repositories: RemoteRepositoryEntry[] | undefined;
  /** Prose from the host listing; the free-text path field stays usable while it is set. */
  error: string | null;
}

/** The remote host's git working trees, listed over ssh by the main process; `enabled` gates the call. */
export function useRemoteRepositories(enabled: boolean): UseRemoteRepositoriesResult {
  const bridge = desktopBridge();
  const query = useQuery({
    queryKey: ["execution-host", "repositories"],
    enabled: enabled && bridge !== null,
    queryFn: async () => {
      if (bridge === null) throw new Error("Desktop bridge unavailable.");
      const result = await bridge.executionHost.listRemoteRepositories();
      if (!result.ok) throw new Error(result.message);
      return result.repositories;
    },
  });

  return {
    repositories: query.data,
    error: query.error === null ? null : query.error.message,
  };
}
