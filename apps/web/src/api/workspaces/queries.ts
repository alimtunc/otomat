import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => daemon.listWorkspaces(),
    staleTime: 15_000,
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
