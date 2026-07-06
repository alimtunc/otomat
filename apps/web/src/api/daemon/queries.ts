import type { ConnectionState } from "@otomat/ui";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => daemon.health(),
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });
}

export interface DaemonStatus {
  connectionState: ConnectionState;
  /** Timestamp of the last successful health response, or null if never reached. */
  lastSyncAt: number | null;
  retry: () => void;
}

/**
 * Coarse daemon connection state derived from the health poll: `online` on a
 * successful response, `offline` on error while not mid-request, else
 * `reconnecting`. `lastSyncAt` is the last successful health timestamp, or null.
 */
export function useDaemonStatus(): DaemonStatus {
  const health = useHealth();
  let connectionState: ConnectionState = "reconnecting";
  if (health.isSuccess) connectionState = "online";
  else if (health.isError && health.fetchStatus !== "fetching") connectionState = "offline";
  return {
    connectionState,
    lastSyncAt: health.dataUpdatedAt > 0 ? health.dataUpdatedAt : null,
    retry: () => void health.refetch(),
  };
}

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: () => daemon.listProjects() });
}

export function useRepositories() {
  return useQuery({ queryKey: queryKeys.repositories, queryFn: () => daemon.listRepositories() });
}

/** The daemon's runtime registry (adapter ids + honest capabilities); static per daemon process. */
export function useRuntimes() {
  return useQuery({
    queryKey: queryKeys.runtimes,
    queryFn: () => daemon.listRuntimes(),
    staleTime: Infinity,
  });
}
