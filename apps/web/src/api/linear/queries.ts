import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Polls only while a pass is in flight, so a pass started elsewhere still shows up. */
export function useLinearSyncStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.linearSyncStatus(projectId ?? ""),
    queryFn: projectId === undefined ? skipToken : () => daemon.getLinearSyncStatus(projectId),
    refetchInterval: (query) => (query.state.data?.running === true ? 1_500 : false),
  });
}
