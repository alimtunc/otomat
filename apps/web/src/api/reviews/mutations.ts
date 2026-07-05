import { DaemonRequestError } from "@otomat/client";
import type { CreateReviewCommentRequest, PreparePullRequestRequest } from "@otomat/domain";
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
  if (error instanceof DaemonRequestError && error.status === 409) {
    return "Fix not started — the run or the selected comments are not fixable right now.";
  }
  return "Could not request the fix — is the daemon running?";
}

export function useRequestFix(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (commentIds: string[]) => daemon.requestFix(runId, { comment_ids: commentIds }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.run(runId) });
      toast.success("Fix turn started");
    },
    onError: (error) => toast.error(fixErrorMessage(error)),
  });
}

export function usePreparePullRequest(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PreparePullRequestRequest) => daemon.preparePullRequest(runId, request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      toast.success("Pull request draft saved");
    },
    onError: () => toast.error("Could not save the pull request draft — is the daemon running?"),
  });
}
