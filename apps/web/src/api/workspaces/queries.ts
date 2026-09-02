import { skipToken, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

/** A project lives on one host, so its worktrees are read from the daemon that owns it and no other. */
export function useProjectWorkspaces(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.workspacesForProject(projectId),
    queryFn: projectId === undefined ? skipToken : () => daemon.listWorkspaces({ projectId }),
    staleTime: 15_000,
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

export function useWorkspaceSettings(projectId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.workspaceSettings(projectId),
    queryFn: () => daemon.workspaceSettings(projectId),
    staleTime: 30_000,
  });
}
