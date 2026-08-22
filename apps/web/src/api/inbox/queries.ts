import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** Polled rather than streamed: pull-request review state changes on a sync the activity stream never carries. */
export function useInbox() {
  return useQuery({
    queryKey: queryKeys.inbox,
    queryFn: () => daemon.listInbox(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}
