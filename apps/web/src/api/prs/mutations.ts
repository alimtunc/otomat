import { DaemonRequestError } from "@otomat/client";
import type { PreparePullRequestRequest, PushPullRequestRequest } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** The daemon's own reason when it sent one; a refused push is only actionable if its message survives. */
function daemonErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof DaemonRequestError &&
    typeof error.body === "object" &&
    error.body !== null
  ) {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
  }
  return fallback;
}

export function useConnectGitHub() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => daemon.connectGitHub(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.githubConnection });
      toast.success("GitHub sign-in started — enter the code shown in the PR panel");
    },
    onError: () => toast.error("Could not start GitHub login — is the daemon running?"),
  });
}

/** No cache to refresh: the drafted metadata lands in the form, which stays editable. */
export function useDraftPullRequest(runId: string) {
  return useMutation({
    mutationFn: () => daemon.draftPullRequest(runId),
    onError: (error) =>
      toast.error(
        daemonErrorMessage(error, "Could not draft the pull request — is the daemon running?"),
      ),
  });
}

/** A refused push refetches: the lease on offer must stand on a remote head read after the refusal, never before it. */
export function usePushPullRequestCommits(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PushPullRequestRequest) => daemon.pushPullRequestCommits(runId, request),
    onSuccess: (detail) => {
      client.setQueryData(queryKeys.runPullRequest(runId), detail);
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      toast.success(
        detail.sync?.dirty === true
          ? "Commits pushed — uncommitted changes stay local"
          : "Commits pushed to the pull request",
      );
    },
    onError: (error) => {
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      toast.error(daemonErrorMessage(error, "Could not push — is the daemon running?"));
    },
  });
}

export function usePreparePullRequest(runId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PreparePullRequestRequest) => daemon.preparePullRequest(runId, request),
    onSuccess: (detail) => {
      client.setQueryData(queryKeys.runPullRequest(runId), detail);
      client.invalidateQueries({ queryKey: queryKeys.runPullRequest(runId) });
      const pullRequest = detail.pull_request;
      if (pullRequest?.status === "merged" || pullRequest?.status === "closed") {
        toast.success(`Pull request #${pullRequest.number} is ${pullRequest.status}`);
        return;
      }
      if (pullRequest?.publication_status === "created") {
        toast.success(`Pull request #${pullRequest.number} is ready`);
        return;
      }
      if (pullRequest?.error_message) {
        toast.error(pullRequest.error_message);
      }
    },
    onError: (error) =>
      toast.error(
        daemonErrorMessage(error, "Could not publish the pull request — is the daemon running?"),
      ),
  });
}
