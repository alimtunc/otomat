import type { ReviewTarget } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/**
 * Never polled. A run's surface is event-driven (invalidated by its ledger stream, see
 * RunEventsProvider); a pull request's refreshes only through the explicit Refresh mutation.
 */
export function useReviewDiff(target: ReviewTarget) {
  return useQuery({
    queryKey: queryKeys.reviewDiff(target),
    queryFn: () => daemon.getReviewDiff(target),
  });
}

export function useReviewDetail(target: ReviewTarget) {
  return useQuery({
    queryKey: queryKeys.reviewDetail(target),
    queryFn: () => daemon.getReviewDetail(target),
  });
}

/** The one list the Reviews view and the sidebar count read: runs resting on a diff, plus adopted pull requests. */
export function useReviewQueue(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviewQueue(projectId),
    queryFn: () => daemon.listReviewQueue(projectId ?? ""),
    enabled: projectId !== undefined,
  });
}
