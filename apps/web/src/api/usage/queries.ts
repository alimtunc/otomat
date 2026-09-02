import type { UsageFilters } from "@otomat/domain";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";

export function useUsageDashboard(filters: UsageFilters) {
  const keys = useQueryKeys();
  return useQuery({
    queryKey: keys.usageDashboard(filters),
    queryFn: () => daemon.getUsageDashboard(filters),
    placeholderData: keepPreviousData,
  });
}
