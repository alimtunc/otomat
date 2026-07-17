import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Event-driven: invalidated by the run's ledger stream on `review.*` events (see RunEventsProvider), never polled. */
export function useRunReview(runId: string) {
  return useQuery({
    queryKey: queryKeys.runReview(runId),
    queryFn: () => daemon.getRunReview(runId),
  });
}
