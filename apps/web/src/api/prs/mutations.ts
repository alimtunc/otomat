import { DaemonRequestError } from "@otomat/client";
import type {
  AttachPullRequestRequest,
  PublishPullRequestRequest,
  PushPullRequestRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { useQueryKeys } from "@web/api/use-query-keys";
import { pullRequestImportRefusal } from "@web/lib/pull-request/import-error";

function daemonErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof DaemonRequestError &&
    typeof error.body === "object" &&
    error.body !== null &&
    "message" in error.body
  ) {
    const message = error.body.message;
    if (typeof message === "string" && message !== "") return message;
  }
  return fallback;
}

interface RefreshPullRequestVariables {
  announce: boolean;
}

function invalidateIssuePullRequests(
  client: QueryClient,
  keys: HostQueryKeys,
  issueId: string | null,
): void {
  if (issueId !== null) {
    client.invalidateQueries({ queryKey: keys.issuePullRequests(issueId) });
    client.invalidateQueries({ queryKey: keys.issues });
  }
  client.invalidateQueries({ queryKey: keys.reviews });
  client.invalidateQueries({ queryKey: keys.inbox });
}

export function useConnectGitHub() {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: () => daemon.connectGitHub(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.githubConnection });
      toast.success("GitHub sign-in started — enter the code shown in the PR panel");
    },
    onError: () => toast.error("Could not start GitHub login — is the daemon running?"),
  });
}

/** The proposal is persisted daemon-side, so the publication draft it becomes is refetched, never mirrored here. */
export function useGeneratePullRequestMetadata(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: () => daemon.generatePullRequestMetadata(runId),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.runPullRequest(runId) }),
    onError: (error) =>
      toast.error(
        daemonErrorMessage(error, "Could not write the pull request — is the daemon running?"),
      ),
  });
}

/** A refused push refetches: the lease on offer must stand on a remote head read after the refusal, never before it. */
export function usePushPullRequestCommits(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: PushPullRequestRequest) => daemon.pushPullRequestCommits(runId, request),
    onSuccess: (detail) => {
      client.setQueryData(keys.runPullRequest(runId), detail);
      client.invalidateQueries({ queryKey: keys.runPullRequest(runId) });
      toast.success(
        detail.sync?.dirty === true
          ? "Commits pushed — uncommitted changes stay local"
          : "Commits pushed to the pull request",
      );
    },
    onError: (error) => {
      client.invalidateQueries({ queryKey: keys.runPullRequest(runId) });
      toast.error(daemonErrorMessage(error, "Could not push — is the daemon running?"));
    },
  });
}

/** The daemon owns the publication once it accepts it; the run's ledger stream reports every phase after. */
export function usePublishPullRequest(runId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: PublishPullRequestRequest) => daemon.publishPullRequest(runId, request),
    onSuccess: (detail) => {
      client.setQueryData(keys.runPullRequest(runId), detail);
      client.invalidateQueries({ queryKey: keys.runPullRequest(runId) });
      const pullRequest = detail.pull_request;
      if (pullRequest?.status === "merged" || pullRequest?.status === "closed") {
        toast.success(`Pull request #${pullRequest.number} is ${pullRequest.status}`);
        return;
      }
      toast.success("Publishing — it continues even if you leave this page");
    },
    onError: (error) =>
      toast.error(
        daemonErrorMessage(error, "Could not publish the pull request — is the daemon running?"),
      ),
  });
}

/** The refusal is returned rather than only toasted: the attach form shows it next to the field it refuses. */
export function useAttachPullRequest(issueId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (request: AttachPullRequestRequest) => daemon.attachPullRequest(issueId, request),
    onSuccess: (pullRequest) => {
      invalidateIssuePullRequests(client, keys, issueId);
      toast.success(`Pull request #${pullRequest.number ?? ""} attached`);
    },
  });
}

/** Keyed by pull request so the automatic pass and the operator's own Refresh are one in-flight reconciliation. */
export function useRefreshPullRequest(pullRequestId: string, issueId: string | null) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationKey: keys.pullRequestRefresh(pullRequestId),
    mutationFn: (_variables: RefreshPullRequestVariables) =>
      daemon.refreshPullRequest(pullRequestId),
    onSuccess: (context) => {
      client.setQueryData(keys.pullRequest(context.pull_request.id), context);
      invalidateIssuePullRequests(client, keys, issueId);
      client.invalidateQueries({
        queryKey: keys.reviewDiff({ kind: "pull_request", id: context.pull_request.id }),
      });
    },
    onError: (error, variables) => {
      if (variables.announce)
        toast.error(
          pullRequestImportRefusal(error) ?? "Could not refresh the pull request from GitHub.",
        );
    },
  });
}

export function useDetachPullRequest(issueId: string) {
  const client = useQueryClient();
  const keys = useQueryKeys();
  return useMutation({
    mutationFn: (pullRequestId: string) => daemon.detachPullRequest(pullRequestId),
    onSuccess: (_, pullRequestId) => {
      client.removeQueries({ queryKey: keys.pullRequest(pullRequestId) });
      invalidateIssuePullRequests(client, keys, issueId);
      toast.success("Attachment removed — the pull request itself is untouched");
    },
    onError: (error) =>
      toast.error(pullRequestImportRefusal(error) ?? "Could not remove the attachment."),
  });
}
