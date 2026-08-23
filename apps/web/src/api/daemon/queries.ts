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
  lastSyncAt: number | null;
  retry: () => void;
}

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

export function useRepositoryBranches(repositoryId: string | null) {
  return useQuery({
    queryKey: queryKeys.repositoryBranches(repositoryId),
    queryFn: repositoryId === null ? skipToken : () => daemon.listRepositoryBranches(repositoryId),
    staleTime: 15_000,
  });
}

export function useRepositoryFiles(repositoryId: string | null, query: string) {
  return useQuery({
    queryKey: queryKeys.repositoryFiles(repositoryId, query),
    queryFn:
      repositoryId === null ? skipToken : () => daemon.searchRepositoryFiles(repositoryId, query),
    staleTime: 15_000,
  });
}

/** Short staleTime so installing a CLI shows up without a daemon restart. */
export function useRuntimes() {
  return useQuery({
    queryKey: queryKeys.runtimes,
    queryFn: () => daemon.listRuntimes(),
    staleTime: 30_000,
  });
}

export function useRuntimeModels(runtimeId: string | null) {
  return useQuery({
    queryKey: queryKeys.runtimeModels(runtimeId),
    queryFn: runtimeId === null ? skipToken : () => daemon.runtimeModels(runtimeId),
    staleTime: 60_000,
  });
}

export function useExecutionDefaults() {
  return useQuery({
    queryKey: queryKeys.executionDefaults,
    queryFn: () => daemon.executionDefaults(),
    staleTime: 30_000,
  });
}

export function usePullRequestGenerator() {
  return useQuery({
    queryKey: queryKeys.pullRequestGenerator,
    queryFn: () => daemon.pullRequestGenerator(),
    staleTime: 30_000,
  });
}

/** Model-scoped because Codex publishes its reasoning levels per model. */
export function useRuntimeProviderOptions(runtimeId: string | null, model: string | null) {
  return useQuery({
    queryKey: queryKeys.runtimeOptions(runtimeId, model),
    queryFn:
      runtimeId === null
        ? skipToken
        : () => daemon.runtimeProviderOptions(runtimeId, model ?? undefined),
    staleTime: 60_000,
  });
}
