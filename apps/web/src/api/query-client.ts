import { QueryClient } from "@tanstack/react-query";

// Offline-first reads: staleTime bounds refetch churn during rapid navigation, and gcTime
// keeps every view seen this session renderable so back-navigation never shows a loader.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 3_600_000, retry: false },
  },
});
