import { WORKSPACE_DIFF_SCOPE, type ReviewTarget, type RunDiffScopeSelector } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/**
 * Never polled. A run's surface is event-driven (invalidated by its ledger stream, see
 * RunEventsProvider); a pull request's refreshes only through the explicit Refresh mutation.
 */
export function useReviewDiff(
  target: ReviewTarget,
  scope: RunDiffScopeSelector = WORKSPACE_DIFF_SCOPE,
) {
  return useQuery({
    queryKey: queryKeys.reviewDiff(target, scope),
    queryFn: () => daemon.getReviewDiff(target, scope),
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

/** Keyed outside the review subtree: the proof rests on a captured boundary, so no review event can change it. */
export function useCommentFixProof(runId: string, commentId: string) {
  return useQuery({
    queryKey: queryKeys.commentFixProof(runId, commentId),
    queryFn: () => daemon.getCommentFixProof(runId, commentId),
    staleTime: Infinity,
  });
}
