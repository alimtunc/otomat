import type { UsageFilters } from "@otomat/domain";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";

export function useUsageDashboard(filters: UsageFilters) {
  return useQuery({
    queryKey: queryKeys.usageDashboard(filters),
    queryFn: () => daemon.getUsageDashboard(filters),
    placeholderData: keepPreviousData,
  });
}
