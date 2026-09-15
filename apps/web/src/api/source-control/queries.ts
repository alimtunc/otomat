import type { CheckoutTarget } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { retryTransportOnly } from "@web/api/query-client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useSourceControl(target: CheckoutTarget, enabled = true) {
  const keys = useQueryKeys();
  return useQuery({
    enabled,
    queryKey: keys.sourceControl(target),
    queryFn: () => daemon.getSourceControl(target),
    retry: retryTransportOnly,
  });
}
