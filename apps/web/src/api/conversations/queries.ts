import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

/** The view's stream writes into this same cache; the interval keeps the sidebar badge honest while the view is closed. */
export function useConversations() {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.conversations,
    queryFn: () => daemon.listConversations(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}
