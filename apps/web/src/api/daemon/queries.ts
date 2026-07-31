import type { ConnectionState } from "@otomat/ui";
import { skipToken, useQuery } from "@tanstack/react-query";
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

export function useRepositories(projectId?: string) {
  return useQuery({
    queryKey:
      projectId === undefined ? queryKeys.repositories : queryKeys.repositoriesFor(projectId),
    queryFn: () => daemon.listRepositories(projectId === undefined ? {} : { projectId }),
  });
}

/** Base-branch candidates for one repository; the daemon reads them from the real repo, so this is never cached long. */
export function useRepositoryBranches(repositoryId: string | null) {
  return useQuery({
    queryKey: queryKeys.repositoryBranches(repositoryId),
    queryFn: repositoryId === null ? skipToken : () => daemon.listRepositoryBranches(repositoryId),
    staleTime: 15_000,
  });
}

/** The daemon's runtime catalog with probed availability; short staleTime so installing a CLI shows up without a daemon restart. */
export function useRuntimes() {
  return useQuery({
    queryKey: queryKeys.runtimes,
    queryFn: () => daemon.listRuntimes(),
    staleTime: 30_000,
  });
}

/** One runtime's model catalog; fetched only once a runtime is chosen, because the daemon probes the installed binary to build it. */
export function useRuntimeModels(runtimeId: string | null) {
  return useQuery({
    queryKey: queryKeys.runtimeModels(runtimeId),
    queryFn: runtimeId === null ? skipToken : () => daemon.runtimeModels(runtimeId),
    staleTime: 60_000,
  });
}
