import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

/** The host's whole activity snapshot. The live stream writes into this same cache; the interval is only the fallback for a stream that never opened. */
export function useActivity() {
  return useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => daemon.listActivity(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}
