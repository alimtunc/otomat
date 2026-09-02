import type { PullRequestInboxSync } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { usePullRequestInbox } from "@web/api/reviews/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useCallback, useEffect } from "react";

const FRESH_FOR_MS = 60_000;

const REFRESH_INTERVAL_MS = 120_000;

interface RefreshVariables {
  project_id: string;
  announce: boolean;
}

export interface PullRequestInboxSyncState extends Omit<PullRequestInboxSync, "repositories"> {
  repositories: number | null;
  refresh: () => void;
}

export function usePullRequestInboxSync(projectId: string | undefined): PullRequestInboxSyncState {
  const keys = useQueryKeys();
  const client = useQueryClient();
  const inbox = usePullRequestInbox(projectId).data;
  const mutationKey = keys.pullRequestInboxSync(projectId ?? "");
  const pending = useIsMutating({ mutationKey }) > 0;
  const { mutate } = useMutation({
    mutationKey,
    mutationFn: (variables: RefreshVariables) => daemon.syncPullRequestInbox(variables.project_id),
    onSuccess: (next) => client.setQueryData(keys.pullRequestInbox(next.project_id), next),
    onError: (_error, variables) => {
      if (variables.announce)
        toast.error("Could not refresh pull requests — is the daemon running?");
    },
  });

  const start = useCallback(
    (announce: boolean) => {
      if (projectId === undefined) return;
      if (client.isMutating({ mutationKey: keys.pullRequestInboxSync(projectId) }) > 0) return;
      mutate({ project_id: projectId, announce });
    },
    [client, keys, mutate, projectId],
  );

  const refresh = useCallback(() => start(true), [start]);

  const repositories = inbox?.sync.repositories ?? null;
  const syncedAt = inbox?.sync.last_synced_at ?? null;
  const refreshIfStale = useCallback(() => {
    if (repositories === 0) return;
    if (syncedAt !== null && Date.now() - Date.parse(syncedAt) < FRESH_FOR_MS) return;
    start(false);
  }, [start, repositories, syncedAt]);

  // otomat-allow-effect: subscribe the inbox to its own cadence — mount, window focus and an interval that stops with the view.
  useEffect(() => {
    refreshIfStale();
    const interval = setInterval(refreshIfStale, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, [refreshIfStale]);

  return {
    running: pending || inbox?.sync.running === true,
    repositories,
    last_synced_at: syncedAt,
    last_error: inbox?.sync.last_error ?? null,
    refresh,
  };
}
