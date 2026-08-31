import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Every connection this daemon knows, whether or not it currently holds its key. */
export function useLinearConnections() {
  return useQuery({
    queryKey: queryKeys.linearConnections,
    queryFn: () => daemon.listLinearConnections(),
  });
}

export function useLinearWorkspace(connectionId: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.linearWorkspaceFor(connectionId),
    queryFn:
      connectionId === null
        ? skipToken
        : async () => {
            try {
              return await daemon.getLinearWorkspace(connectionId);
            } catch (error) {
              await client.invalidateQueries({ queryKey: queryKeys.linearConnections });
              throw error;
            }
          },
    staleTime: 30_000,
  });
}

export function useIssueSources(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.issueSourcesFor(projectId),
    queryFn: () => daemon.listIssueSources({ projectId }),
  });
}

/** Polled while a pass is in flight so a pass started elsewhere still shows up. */
export function useLinearSyncStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.linearSyncStatus(projectId ?? ""),
    queryFn: projectId === undefined ? skipToken : () => daemon.getLinearSyncStatus(projectId),
    refetchInterval: (query) => (query.state.data?.running === true ? 1_500 : false),
  });
}
