import { DEFAULT_DIFF_SCOPE, type ReviewTarget, type RunDiffScopeSelector } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useReviewDiff(
  target: ReviewTarget,
  scope: RunDiffScopeSelector = DEFAULT_DIFF_SCOPE,
) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.reviewDiff(target, scope),
    // Carries the scope it was read for, so a retained answer is never paired with the next scope's trees.
    queryFn: async () => ({ ...(await daemon.getReviewDiff(target, scope)), requested: scope }),
    placeholderData: (previous) => (previous?.subject_id === target.id ? previous : undefined),
  });
}

export function useReviewDetail(target: ReviewTarget) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.reviewDetail(target),
    queryFn: () => daemon.getReviewDetail(target),
  });
}

export function usePullRequestInbox(projectId: string | undefined) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.pullRequestInbox(projectId),
    queryFn: () => daemon.getPullRequestInbox(projectId ?? ""),
    enabled: projectId !== undefined,
  });
}

/** Keyed outside the review subtree: the proof rests on a captured boundary, so no review event can change it. */
export function useCommentFixProof(runId: string, commentId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.commentFixProof(runId, commentId),
    queryFn: () => daemon.getCommentFixProof(runId, commentId),
    staleTime: Infinity,
  });
}
