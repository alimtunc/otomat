import { DaemonRequestError } from "@otomat/client";
import {
  workspaceCleanupErrorSchema,
  type ExecutionHostId,
  type WorkspaceSettings,
} from "@otomat/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { ExecutionHostCallError, onExecutionHost } from "@web/api/host-call";
import { hostKeys } from "@web/api/query-keys";
import { useQueryKeys } from "@web/api/use-query-keys";

/** A reconciliation moves worktrees, runs and issues alike, so every surface reading them is refreshed. */
export function useReconcileWorkspaces() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (hostId: ExecutionHostId) =>
      onExecutionHost(
        hostId,
        () => daemon.reconcileWorkspaces(),
        (executionHost) => executionHost.reconcileWorkspaces(hostId),
      ),
    onSuccess: (report, hostId) => {
      const keys = hostKeys(hostId);
      client.setQueryData(keys.workspaces, report.inventory);
      client.invalidateQueries({ queryKey: keys.workspaces });
      client.invalidateQueries({ queryKey: keys.issues });
      client.invalidateQueries({ queryKey: keys.runs });
    },
  });
}

export interface CleanupWorkspaceInput {
  hostId: ExecutionHostId;
  worktreeId: string;
}

export function useCleanupWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ hostId, worktreeId }: CleanupWorkspaceInput) =>
      onExecutionHost(
        hostId,
        () => daemon.cleanupWorkspace(worktreeId),
        (executionHost) => executionHost.cleanupWorkspace(hostId, worktreeId),
      ),
    onSuccess: (_result, { hostId }) => {
      const keys = hostKeys(hostId);
      client.invalidateQueries({ queryKey: keys.workspaces });
      client.invalidateQueries({ queryKey: keys.issues });
      client.invalidateQueries({ queryKey: keys.runs });
    },
  });
}

export function useSetWorkspaceSettings() {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (settings: WorkspaceSettings) => daemon.setWorkspaceSettings(settings),
    onSuccess: (settings) => {
      client.setQueryData(keys.workspaceSettings, settings);
      client.invalidateQueries({ queryKey: keys.workspaceSettings });
    },
  });
}

export function cleanupWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = workspaceCleanupErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    return "Could not clean this workspace — the daemon rejected the request.";
  }
  if (error instanceof ExecutionHostCallError) return error.message;
  return "Could not clean this workspace — is the daemon running?";
}
