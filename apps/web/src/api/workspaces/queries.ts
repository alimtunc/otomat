import type { ExecutionHostDescriptor, WorkspaceInventory } from "@otomat/domain";
import { skipToken, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { onExecutionHost } from "@web/api/host-call";
import { hostKeys } from "@web/api/query-keys";
import { useQueryKeys } from "@web/api/use-query-keys";

/** One query per host, so a host that stops answering keeps its last inventory and its own staleness. */
export function useHostWorkspaces(
  hosts: readonly ExecutionHostDescriptor[],
): UseQueryResult<WorkspaceInventory>[] {
  return useQueries({
    queries: hosts.map((host) => ({
      queryKey: hostKeys(host.id).workspaces,
      queryFn: () =>
        onExecutionHost(
          host.id,
          () => daemon.listWorkspaces(),
          (executionHost) => executionHost.readWorkspaces(host.id),
        ),
      staleTime: 15_000,
    })),
  });
}

export function useWorkspacesForRun(runId: string | null) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.workspacesForRun(runId),
    queryFn: runId === null ? skipToken : () => daemon.listWorkspaces({ runId }),
    staleTime: 15_000,
  });
}

export function useWorkspaceSettings() {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.workspaceSettings,
    queryFn: () => daemon.workspaceSettings(),
    staleTime: 30_000,
  });
}
