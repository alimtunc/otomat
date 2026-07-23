import { isRunTerminal } from "@otomat/domain";
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
 * Fetches one run's detail and polls it every 1.5s until the run reaches a
 * terminal status, then stops refetching.
 */
export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => daemon.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && isRunTerminal(status) ? false : 1_500;
    },
  });
}

export function useRunCompletionReport(runId: string) {
  return useQuery({
    queryKey: queryKeys.runCompletionReport(runId),
    queryFn: () => daemon.getRunCompletionReport(runId),
  });
}
