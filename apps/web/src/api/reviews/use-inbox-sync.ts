import type { PullRequestInboxSync } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { usePullRequestInbox } from "@web/api/reviews/queries";
import { useCallback, useEffect } from "react";

/** A success this recent is reused instead of asking GitHub again. */
const FRESH_FOR_MS = 60_000;

const REFRESH_INTERVAL_MS = 120_000;

interface RefreshVariables {
  project_id: string;
  /** Reports the outcome as a toast. Automatic passes stay silent and speak through `last_error`. */
  announce: boolean;
}

export interface PullRequestInboxSyncState extends Omit<PullRequestInboxSync, "repositories"> {
  /** Null until the inbox has answered, so the control states nothing it cannot know yet. */
  repositories: number | null;
  refresh: () => void;
}

export function usePullRequestInboxSync(projectId: string | undefined): PullRequestInboxSyncState {
  const client = useQueryClient();
  const inbox = usePullRequestInbox(projectId).data;
  const mutationKey = queryKeys.pullRequestInboxSync(projectId ?? "");
  const pending = useIsMutating({ mutationKey }) > 0;
  const { mutate } = useMutation({
    mutationKey,
    mutationFn: (variables: RefreshVariables) => daemon.syncPullRequestInbox(variables.project_id),
    onSuccess: (next) => client.setQueryData(queryKeys.pullRequestInbox(next.project_id), next),
    onError: (_error, variables) => {
      if (variables.announce)
        toast.error("Could not refresh pull requests — is the daemon running?");
    },
  });

  const start = useCallback(
    (announce: boolean) => {
      if (projectId === undefined) return;
      if (client.isMutating({ mutationKey: queryKeys.pullRequestInboxSync(projectId) }) > 0) return;
      mutate({ project_id: projectId, announce });
    },
    [client, mutate, projectId],
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
