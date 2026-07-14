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
  if (error instanceof DaemonRequestError && error.status === 409) {
    return "Fix not started — the run or the selected comments are not fixable right now.";
  }
  return "Could not request the fix — is the daemon running?";
}

/**
 * Requests a fix turn over the given comment ids. On success invalidates the
 * run's detail and toasts. A 409 means the run or comments are not fixable now.
 */
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

/** Starts GitHub CLI's official browser login and lets the connection query observe completion. */
export function useConnectGitHub() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.connectGitHub(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.githubConnection });
      toast.success("GitHub login opened in your browser");
    },
    onError: () => toast.error("Could not start GitHub login — is the daemon running?"),
  });
}

/** Publishes or updates the run's real GitHub pull request. */
export function usePreparePullRequest(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PreparePullRequestRequest) => daemon.preparePullRequest(runId, request),
    onSuccess: (detail) => {
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      const pullRequest = detail.pull_request;
      if (pullRequest?.publication_status === "created") {
        toast.success(`Pull request #${pullRequest.number} is ready`);
        return;
      }
      if (pullRequest?.error_message) {
        toast.error(pullRequest.error_message);
      }
    },
    onError: () => toast.error("Could not publish the pull request — is the daemon running?"),
  });
}
