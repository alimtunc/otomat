import type { ExecutionHostDescriptor, WorkspaceInventory } from "@otomat/domain";
import { skipToken, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { onWorkspaceHost } from "@web/api/workspaces/host-call";

/** One query per host, so a host that stops answering keeps its last inventory and its own staleness. */
export function useHostWorkspaces(
  hosts: readonly ExecutionHostDescriptor[],
): UseQueryResult<WorkspaceInventory>[] {
  return useQueries({
    queries: hosts.map((host) => ({
      queryKey: queryKeys.workspacesForHost(host.id),
      queryFn: () =>
        onWorkspaceHost(
          host.id,
          () => daemon.listWorkspaces(),
          (executionHost) => executionHost.readWorkspaces(host.id),
        ),
      staleTime: 15_000,
    })),
  });
}

export function useWorkspacesForRun(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.workspacesForRun(runId),
    queryFn: runId === null ? skipToken : () => daemon.listWorkspaces({ runId }),
    staleTime: 15_000,
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: queryKeys.workspaceSettings,
    queryFn: () => daemon.workspaceSettings(),
    staleTime: 30_000,
  });
}
