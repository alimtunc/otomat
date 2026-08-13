import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  reviewCommentErrorSchema,
  runStepAppendErrorSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
  type ReviewCommentContract,
  type ReviewDetail,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

function reviewRefusal(error: unknown): string | null {
  if (!(error instanceof DaemonRequestError)) return null;
  const refusal = reviewCommentErrorSchema.safeParse(error.body);
  return refusal.success ? refusal.data.message : null;
}

/** Writes the daemon's own answer into the review cache before the refetch confirms it. */
function seedComment(client: QueryClient, runId: string, comment: ReviewCommentContract): void {
  client.setQueryData(queryKeys.runReview(runId), (current: ReviewDetail | undefined) => {
    if (current === undefined) return current;
    const known = current.comments.some((row) => row.id === comment.id);
    return {
      ...current,
      comments: known
        ? current.comments.map((row) => (row.id === comment.id ? comment : row))
        : [...current.comments, comment],
    };
  });
  client.invalidateQueries({ queryKey: queryKeys.runReview(runId) });
}

function commentErrorMessage(error: unknown): string {
  const refusal = reviewRefusal(error);
  if (refusal !== null) return refusal;
  if (error instanceof DaemonRequestError && error.status === 409) {
    return "The diff changed under this comment — it was refreshed, please re-anchor.";
  }
  return "Could not add the comment — is the daemon running?";
}

export function useAddReviewComment(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateReviewCommentRequest) => daemon.addReviewComment(runId, request),
    onSuccess: (comment) => seedComment(client, runId, comment),
    onError: (error) => {
      if (error instanceof DaemonRequestError && error.status === 409) {
        client.invalidateQueries({ queryKey: queryKeys.runDiff(runId) });
      }
      toast.error(commentErrorMessage(error));
    },
  });
}

/** The daemon persists the outcome either way, so even a failure refreshes: the comment shows `failed`, never vanishes. */
export function usePublishReviewComment(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => daemon.publishReviewComment(runId, commentId),
    onSuccess: (comment) => seedComment(client, runId, comment),
    onError: (error) => {
      client.invalidateQueries({ queryKey: queryKeys.runReview(runId) });
      toast.error(reviewRefusal(error) ?? "Could not publish the comment — is the daemon running?");
    },
  });
}

function fixErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError) {
    const refusal = runStepAppendErrorSchema.safeParse(error.body);
    if (refusal.success) return refusal.data.message;
    const profile = agentProfileErrorSchema.safeParse(error.body);
    if (profile.success) return profile.data.message;
    if (error.status === 409) {
      return "Fix not added — the run or the selected comments are not fixable right now.";
    }
  }
  return "Could not request the fix — is the daemon running?";
}

/**
 * Appends a `Fix review comments` step carrying the selected comments as its
 * frozen context. On success invalidates the run's detail, its review and the
 * issues cache; a refusal is shown verbatim so the user can act on it.
 */
export function useRequestFix(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: RequestFixRequest) => daemon.requestFix(runId, request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      client.invalidateQueries({ queryKey: queryKeys.runReview(runId) });
      client.invalidateQueries({ queryKey: queryKeys.issues });
      toast.success("Fix step added to this issue's workspace");
    },
    onError: (error) => toast.error(fixErrorMessage(error)),
  });
}
