import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useGitHubConnection() {
  return useQuery({
    queryKey: queryKeys.githubConnection,
    queryFn: () => daemon.getGitHubConnection(),
    refetchInterval: (query) => (query.state.data?.status === "connecting" ? 1_000 : false),
  });
}

export function useRunPullRequest(runId: string) {
  return useQuery({
    queryKey: queryKeys.runPullRequest(runId),
    queryFn: () => daemon.getPullRequest(runId),
  });
}

export function useIssuePullRequests(issueId: string) {
  return useQuery({
    queryKey: queryKeys.issuePullRequests(issueId),
    queryFn: () => daemon.listIssuePullRequests(issueId),
  });
}

export function usePullRequestReviewContext(pullRequestId: string) {
  return useQuery({
    queryKey: queryKeys.pullRequest(pullRequestId),
    queryFn: () => daemon.getPullRequestReviewContext(pullRequestId),
  });
}
