import type { ExecutionHostRepositoriesEntry } from "@otomat/domain";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { desktopBridge } from "@web/lib/desktop-bridge";

export function useHostRepositories(): UseQueryResult<ExecutionHostRepositoriesEntry[]> {
  const bridge = desktopBridge();
  return useQuery({
    queryKey: queryKeys.hostRepositories,
    queryFn: async () => {
      if (bridge !== null) return bridge.executionHost.listRepositories();
      return [
        {
          host: { id: "local", label: "Local", kind: "local" },
          active: true,
          status: null,
          repositories: await daemon.listRepositories(),
        },
      ] satisfies ExecutionHostRepositoriesEntry[];
    },
  });
}
