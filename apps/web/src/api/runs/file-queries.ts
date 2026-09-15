import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useRunFiles(runId: string) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.runFiles(runId),
    queryFn: () => daemon.getRunFiles(runId),
    retry: retryTransportOnly,
  });
}
