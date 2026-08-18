import { DaemonRequestError } from "@otomat/client";
import { workspaceCleanupErrorSchema, type WorkspaceSettings } from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** A reconciliation moves worktrees, runs and issues alike, so every surface reading them is refreshed. */
export function useReconcileWorkspaces() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.reconcileWorkspaces(),
    onSuccess: (report) => {
      client.setQueryData(queryKeys.workspaces, report.inventory);
      client.invalidateQueries({ queryKey: queryKeys.workspaces });
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useCleanupWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (worktreeId: string) => daemon.cleanupWorkspace(worktreeId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.workspaces });
      client.invalidateQueries({ queryKey: queryKeys.issues });
      client.invalidateQueries({ queryKey: queryKeys.runs });
    },
  });
}

export function useSetWorkspaceSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: WorkspaceSettings) => daemon.setWorkspaceSettings(settings),
    onSuccess: (settings) => {
      client.setQueryData(queryKeys.workspaceSettings, settings);
      client.invalidateQueries({ queryKey: queryKeys.workspaceSettings });
    },
  });
}

export function cleanupWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = workspaceCleanupErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not clean this workspace — the daemon rejected the request.";
  }
  return "Could not clean this workspace — is the daemon running?";
}
