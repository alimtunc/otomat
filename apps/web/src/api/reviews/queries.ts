import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Event-driven: invalidated by the run's ledger stream (see RunEventsProvider), never polled. */
export function useRunDiff(runId: string) {
  return useQuery({
    queryKey: queryKeys.runDiff(runId),
    queryFn: () => daemon.getRunDiff(runId),
  });
}

export function useRunReview(runId: string) {
  return useQuery({
    queryKey: queryKeys.runReview(runId),
    queryFn: () => daemon.getRunReview(runId),
  });
}

export function useRunPullRequest(runId: string) {
  return useQuery({
    queryKey: queryKeys.runPullRequest(runId),
    queryFn: () => daemon.getPullRequest(runId),
  });
}
