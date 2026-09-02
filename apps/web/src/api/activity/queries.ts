import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

/** The live stream writes into this same cache; the interval is only the fallback for a stream that never opened. */
export function useActivity() {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.activity,
    queryFn: () => daemon.listActivity(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });
}
