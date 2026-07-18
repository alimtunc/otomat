import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Polls only while the delegated browser login is in flight. */
export function useGitHubConnection() {
  return useQuery({
    queryKey: queryKeys.githubConnection,
    queryFn: () => daemon.getGitHubConnection(),
    refetchInterval: (query) => (query.state.data?.status === "connecting" ? 1_000 : false),
  });
}

/** Event-driven: invalidated by the run's ledger stream on `pr.*` events (see RunEventsProvider), never polled. */
export function useRunPullRequest(runId: string) {
  return useQuery({
    queryKey: queryKeys.runPullRequest(runId),
    queryFn: () => daemon.getPullRequest(runId),
  });
}
