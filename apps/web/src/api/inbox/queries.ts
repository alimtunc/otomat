import type { ExecutionHostId, InboxSnapshot } from "@otomat/domain";
import { queryOptions, useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { onExecutionHost } from "@web/api/host-call";
import { hostKeys } from "@web/api/query-keys";
import { useActiveHostId } from "@web/lib/active-host";

/** Polled rather than streamed: pull-request review state changes on a sync the activity stream never carries. */
function hostInboxQuery(host: ExecutionHostId) {
  return queryOptions({
    queryKey: hostKeys(host).inbox,
    queryFn: () =>
      onExecutionHost(
        host,
        () => daemon.listInbox(),
        (executionHost) => executionHost.readInbox(host),
      ),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export function useInbox() {
  const host = useActiveHostId();
  return useQuery(hostInboxQuery(host));
}

/** One query per host, so a project that lost the focus keeps its own Inbox and its own poll. */
export function useHostInboxes(hosts: readonly ExecutionHostId[]): UseQueryResult<InboxSnapshot>[] {
  return useQueries({ queries: hosts.map(hostInboxQuery) });
}
