import { useQuery, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useLinearConnection() {
  return useQuery({
    queryKey: queryKeys.linearConnection,
    queryFn: () => daemon.getLinearConnection(),
  });
}

export function useLinearWorkspace(workspaceId: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.linearWorkspaceFor(workspaceId),
    queryFn: async () => {
      try {
        return await daemon.getLinearWorkspace();
      } catch (error) {
        await client.invalidateQueries({ queryKey: queryKeys.linearConnection });
        throw error;
      }
    },
    enabled: workspaceId !== null,
    staleTime: 30_000,
  });
}

export function useIssueSources(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.issueSourcesFor(workspaceId),
    queryFn: () => daemon.listIssueSources(),
  });
}
