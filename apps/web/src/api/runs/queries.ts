import { isRunSettled } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Runs for the selected project; disabled while no project is selected. */
export function useProjectRuns(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.runsList(projectId),
    queryFn: () => daemon.listRuns({ projectId }),
    enabled: projectId !== undefined,
  });
}

export function useRunsForIssue(issueId: string) {
  return useQuery({
    queryKey: queryKeys.runsForIssue(issueId),
    queryFn: () => daemon.listRuns({ issueId }),
  });
}

/** Event-driven: invalidated by the run's ledger stream (see RunEventsProvider), never polled. */
export function useRunDiff(runId: string) {
  return useQuery({
    queryKey: queryKeys.runDiff(runId),
    queryFn: () => daemon.getRunDiff(runId),
  });
}

export function useCompeteCandidateDiff(runId: string, groupId: string, stepId: string) {
  return useQuery({
    queryKey: queryKeys.competeCandidateDiff(runId, groupId, stepId),
    queryFn: () => daemon.getCompeteCandidateDiff(runId, groupId, stepId),
  });
}

/**
 * Fetches one run's detail and polls it every 1.5s until the run settles, then
 * stops refetching; resuming a settled run invalidates the query and restarts it.
 */
export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => daemon.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && isRunSettled(status) ? false : 1_500;
    },
  });
}

/** What abandoning this run's workspace would leave behind. Read on demand — the confirmation must show the branch as it is now, not as it was cached. */
export function useRunWorkspace(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.runWorkspace(runId),
    queryFn: () => daemon.getRunWorkspace(runId),
    enabled,
    staleTime: 0,
  });
}

/** A run's conversation. Event-driven: the run's ledger stream invalidates it on every contribution change. */
export function useRunContributions(runId: string) {
  return useQuery({
    queryKey: queryKeys.runContributions(runId),
    queryFn: () => daemon.listRunContributions(runId),
  });
}

/** The dossier one session was given. Frozen when that session started, so it never refetches. */
export function useSessionContext(runId: string, agentSessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sessionContext(runId, agentSessionId),
    queryFn: () => daemon.getSessionContext(runId, agentSessionId),
    enabled,
    staleTime: Infinity,
  });
}

export function useRunCompletionReport(runId: string) {
  return useQuery({
    queryKey: queryKeys.runCompletionReport(runId),
    queryFn: () => daemon.getRunCompletionReport(runId),
  });
}
