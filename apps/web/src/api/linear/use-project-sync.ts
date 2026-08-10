import type { LinearSyncStatusContract } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { isSupersededLinearError, linearErrorMessage } from "@web/api/linear/mutations";
import { useLinearConnection, useLinearSyncStatus } from "@web/api/linear/queries";
import { queryKeys } from "@web/api/query-keys";
import { useCallback } from "react";

/** A success this recent is reused instead of asking Linear again. */
const FRESH_FOR_MS = 60_000;

export interface ProjectLinearSyncOptions {
  /** Ignores the stored watermark and re-reads every issue; repairs a drifted cursor. */
  full?: boolean;
  /** Reports the outcome as a toast. Automatic passes stay silent and speak through the status. */
  announce?: boolean;
}

interface RefreshVariables extends ProjectLinearSyncOptions {
  project_id: string;
}

export interface ProjectLinearSync {
  /** Null until the owning daemon has answered; never assume freshness from it. */
  status: LinearSyncStatusContract | null;
  /** True while this project has a pass in flight, wherever it was started. */
  running: boolean;
  refresh: (options?: ProjectLinearSyncOptions) => void;
  /** The automatic path: runs only when the last success is unknown or over a minute old. */
  refreshIfStale: () => void;
}

/**
 * Every Linear refresh for the active project goes through this hook, so only the
 * daemon owning that project is asked and concurrent triggers collapse into one
 * request instead of racing each other.
 */
export function useProjectLinearSync(projectId: string | undefined): ProjectLinearSync {
  const client = useQueryClient();
  const status = useLinearSyncStatus(projectId).data ?? null;
  const connected = useLinearConnection().data?.status === "connected";
  const mutationKey = queryKeys.linearSync(projectId ?? "");
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
        client.invalidateQueries({ queryKey: queryKeys.linearConnection }),
        client.invalidateQueries({ queryKey: queryKeys.issueSources }),
        client.invalidateQueries({ queryKey: queryKeys.issues }),
        client.invalidateQueries({ queryKey: queryKeys.linearSyncStatus(projectId ?? "") }),
      ]);
    },
  });

  const refresh = useCallback(
    (options: ProjectLinearSyncOptions = {}) => {
      if (projectId === undefined) return;
      if (client.isMutating({ mutationKey: queryKeys.linearSync(projectId) }) > 0) return;
      mutate({ project_id: projectId, full: options.full === true, announce: options.announce });
    },
    [client, mutate, projectId],
  );

  const refreshIfStale = useCallback(() => {
    if (!connected || status === null || status.sources === 0 || status.running) return;
    const syncedAt = status.last_synced_at;
    if (syncedAt !== null && Date.now() - Date.parse(syncedAt) < FRESH_FOR_MS) return;
    refresh();
  }, [connected, refresh, status]);

  return { status, running: pending || status?.running === true, refresh, refreshIfStale };
}
