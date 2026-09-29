import { queryOptions, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import type { HostQueryKeys } from "@web/api/query-keys";
import { useQueryKeys } from "@web/api/use-query-keys";

export function conversationsOptions(keys: HostQueryKeys) {
  return queryOptions({ queryKey: keys.conversations, queryFn: () => daemon.listConversations() });
}

/** The view's stream writes into this same cache; the interval keeps the sidebar badge honest while the view is closed. */
export function useConversations() {
  const keys = useQueryKeys();
  return useQuery({
    ...conversationsOptions(keys),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}

export type ConversationsQuery = ReturnType<typeof useConversations>;
