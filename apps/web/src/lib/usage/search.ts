import {
  isUsageDay,
  NO_USAGE_FILTERS,
  USAGE_PERIODS,
  type UsageFilters,
  type UsagePeriod,
} from "@otomat/domain";
import { asMember, asString, normalizedSelection } from "@web/lib/coerce";

/** Only what narrows the default travels: an emptied axis leaves the URL instead of riding it empty. */
export interface UsageSearch {
  period?: UsagePeriod;
  day?: string;
  projects?: string[];
  runtimes?: string[];
  models?: string[];
  issues?: string[];
}

function selection(value: unknown): string[] | undefined {
  return Array.isArray(value) ? normalizedSelection(value) : undefined;
}

function utcDay(value: unknown): string | undefined {
  const raw = asString(value);
  return raw !== null && isUsageDay(raw) ? raw : undefined;
}

export function parseUsageSearch(search: Record<string, unknown>): UsageSearch {
  return {
    period: asMember(search.period, USAGE_PERIODS) ?? undefined,
    day: utcDay(search.day),
    projects: selection(search.projects),
    runtimes: selection(search.runtimes),
    models: selection(search.models),
    issues: selection(search.issues),
  };
}

export function usageFiltersFromSearch(search: UsageSearch): UsageFilters {
  return {
    period: search.period ?? NO_USAGE_FILTERS.period,
    day: search.day ?? null,
    projects: search.projects ?? [],
    runtimes: search.runtimes ?? [],
    models: search.models ?? [],
    issues: search.issues ?? [],
  };
}

function narrowed(values: string[]): string[] | undefined {
  return values.length === 0 ? undefined : values;
}

export function usageSearchFromFilters(filters: UsageFilters): UsageSearch {
  return {
    period: filters.period === NO_USAGE_FILTERS.period ? undefined : filters.period,
    day: filters.day ?? undefined,
    projects: narrowed(filters.projects),
    runtimes: narrowed(filters.runtimes),
    models: narrowed(filters.models),
    issues: narrowed(filters.issues),
  };
}
