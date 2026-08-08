import { DaemonRequestError } from "@otomat/client";
import {
  agentProfileErrorSchema,
  runStepAppendErrorSchema,
  type CreateReviewCommentRequest,
  type RequestFixRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

function commentErrorMessage(error: unknown): string {
  if (error instanceof DaemonRequestError && error.status === 409) {
    return "The diff changed under this comment — it was refreshed, please re-anchor.";
  }
  return "Could not add the comment — is the daemon running?";
}

/**
 * Adds a review comment. On success invalidates the run's review cache. A 409
 * means the diff moved under the anchor: it refreshes the diff cache and toasts
 * asking the user to re-anchor.
 */
export function useAddReviewComment(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateReviewCommentRequest) => daemon.addReviewComment(runId, request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.runReview(runId) });
    },
    onError: (error) => {
      if (error instanceof DaemonRequestError && error.status === 409) {
        client.invalidateQueries({ queryKey: queryKeys.runDiff(runId) });
      }
      toast.error(commentErrorMessage(error));
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
