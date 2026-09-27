import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function usePullRequestStack(pullRequestId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.pullRequestStack(pullRequestId),
    queryFn: () => daemon.getPullRequestStack(pullRequestId),
    retry: false,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
}
