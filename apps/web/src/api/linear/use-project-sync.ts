import type { LinearSyncStatusContract } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { isSupersededLinearError, linearErrorMessage } from "@web/api/linear/mutations";
import { useLinearSyncStatus } from "@web/api/linear/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useCallback } from "react";

const FRESH_FOR_MS = 60_000;

export interface ProjectLinearSyncOptions {
  /** Ignores the stored watermark and re-reads every issue; repairs a drifted cursor. */
  full?: boolean;
  announce?: boolean;
}

interface RefreshVariables extends ProjectLinearSyncOptions {
  project_id: string;
}

export interface ProjectLinearSync {
  status: LinearSyncStatusContract | null;
  /** True for a pass in flight anywhere, not only one this hook started. */
  running: boolean;
  refresh: (options?: ProjectLinearSyncOptions) => void;
  refreshIfStale: () => void;
}

/** Every Linear refresh for the active project funnels here, so concurrent triggers collapse into one request. */
export function useProjectLinearSync(projectId: string | undefined): ProjectLinearSync {
  const keys = useQueryKeys();
  const client = useQueryClient();
  const status = useLinearSyncStatus(projectId).data ?? null;
  const mutationKey = keys.linearSync(projectId ?? "");
  const pending = useIsMutating({ mutationKey }) > 0;
  const { mutate } = useMutation({
    mutationKey,
    mutationFn: (variables: RefreshVariables) =>
      daemon.syncLinear({ project_id: variables.project_id, full: variables.full }),
    onSuccess: (response, variables) => {
      if (variables.announce !== true) return;
      const imported = response.results.reduce((total, result) => total + result.imported, 0);
      const updated = response.results.reduce((total, result) => total + result.updated, 0);
      toast.success(
        imported + updated === 0
          ? "Issues are already up to date."
          : `Synced Linear — ${imported} imported, ${updated} updated.`,
      );
    },
    onError: (error, variables) => {
      if (variables.announce !== true || isSupersededLinearError(error)) return;
      toast.error(linearErrorMessage(error));
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.linearConnections }),
        client.invalidateQueries({ queryKey: keys.issueSources }),
        client.invalidateQueries({ queryKey: keys.issues }),
        client.invalidateQueries({ queryKey: keys.linearSyncStatus(projectId ?? "") }),
      ]);
    },
  });

  const refresh = useCallback(
    (options: ProjectLinearSyncOptions = {}) => {
      if (projectId === undefined) return;
      if (client.isMutating({ mutationKey: keys.linearSync(projectId) }) > 0) return;
      mutate({ project_id: projectId, full: options.full === true, announce: options.announce });
    },
    [client, keys, mutate, projectId],
  );

  const refreshIfStale = useCallback(() => {
    if (status === null || status.connection?.status !== "connected") return;
    if (status.sources === 0 || status.running) return;
    const syncedAt = status.last_synced_at;
    if (syncedAt !== null && Date.now() - Date.parse(syncedAt) < FRESH_FOR_MS) return;
    refresh();
  }, [refresh, status]);

  return { status, running: pending || status?.running === true, refresh, refreshIfStale };
}
