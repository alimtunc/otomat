import { MutationCache, QueryClient } from "@tanstack/react-query";
import { PROJECT_HEALTH_KEY } from "@web/api/query-keys";

// gcTime keeps every view seen this session renderable, so back-navigation never shows a loader.
export const queryClient = new QueryClient({
  // A health report reads a host's whole configuration, so any successful mutation invalidates it, on every host.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[1] === PROJECT_HEALTH_KEY,
      });
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 3_600_000, retry: false },
  },
});
