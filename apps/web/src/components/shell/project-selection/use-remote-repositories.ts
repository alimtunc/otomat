import type { RemoteRepositoryEntry } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { desktopBridge } from "@web/lib/desktop-bridge";

export interface UseRemoteRepositoriesResult {
  repositories: RemoteRepositoryEntry[] | undefined;
  error: string | null;
}

export function useRemoteRepositories(enabled: boolean): UseRemoteRepositoriesResult {
  const bridge = desktopBridge();
  const query = useQuery({
    queryKey: ["execution-host", "repositories"],
    gcTime: 0,
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
