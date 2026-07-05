import { isRunTerminal } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useRunsForIssue(issueId: string) {
  return useQuery({
    queryKey: queryKeys.runsForIssue(issueId),
    queryFn: () => daemon.listRuns({ issueId }),
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
