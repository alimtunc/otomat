import type { UsageFilters } from "@otomat/domain";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { usageFiltersFromSearch, usageSearchFromFilters } from "@web/lib/usage/search";

export interface UsageViewResult {
  filters: UsageFilters;
  setFilters: (filters: UsageFilters) => void;
}

export function useUsageView(): UsageViewResult {
  const search = useSearch({ from: "/usage" });
  const navigate = useNavigate({ from: "/usage" });

  return {
    filters: usageFiltersFromSearch(search),
    setFilters: (filters) => {
      void navigate({ to: "/usage", search: usageSearchFromFilters(filters), replace: true });
    },
  };
}
