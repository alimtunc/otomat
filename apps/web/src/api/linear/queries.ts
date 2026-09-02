import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

/** Every connection this daemon knows, whether or not it currently holds its key. */
export function useLinearConnections() {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearConnections,
    queryFn: () => daemon.listLinearConnections(),
  });
}

export function useLinearWorkspace(connectionId: string | null) {
  const keys = useQueryKeys();
  const client = useQueryClient();
  return useQuery({
    queryKey: keys.linearWorkspaceFor(connectionId),
    queryFn:
      connectionId === null
        ? skipToken
        : async () => {
            try {
              return await daemon.getLinearWorkspace(connectionId);
            } catch (error) {
              await client.invalidateQueries({ queryKey: keys.linearConnections });
              throw error;
            }
          },
    staleTime: 30_000,
  });
}

export function useIssueSources(projectId?: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.issueSourcesFor(projectId),
    queryFn: () => daemon.listIssueSources({ projectId }),
  });
}

/** Polled while a pass is in flight so a pass started elsewhere still shows up. */
export function useLinearSyncStatus(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.linearSyncStatus(projectId ?? ""),
    queryFn: projectId === undefined ? skipToken : () => daemon.getLinearSyncStatus(projectId),
    refetchInterval: (query) => (query.state.data?.running === true ? 1_500 : false),
  });
}
