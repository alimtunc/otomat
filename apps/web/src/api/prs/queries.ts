import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useGitHubConnection() {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.githubConnection,
    queryFn: () => daemon.getGitHubConnection(),
    refetchInterval: (query) => (query.state.data?.status === "connecting" ? 1_000 : false),
  });
}

export function useRunPullRequest(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runPullRequest(runId),
    queryFn: () => daemon.getPullRequest(runId),
  });
}

export function useIssuePullRequests(issueId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.issuePullRequests(issueId),
    queryFn: () => daemon.listIssuePullRequests(issueId),
  });
}

export function usePullRequestReviewContext(pullRequestId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.pullRequest(pullRequestId),
    queryFn: () => daemon.getPullRequestReviewContext(pullRequestId),
  });
}
