import {
  usageFacetValue,
  usageTokenMetric,
  type UsageDashboard,
  type UsageFigures,
  type UsageFilters,
} from "@otomat/domain";
import { formatCostUsd, formatTokenCount } from "@web/lib/run/usage";
import { usageEmitterLabel } from "@web/lib/usage/facets";

/** The narrowing a slice stands for; an axis it says nothing about is left as it is. */
export interface UsageRowSelection {
  day?: string;
  projects?: string[];
  runtimes?: string[];
  models?: string[];
  issues?: string[];
}

export interface UsageBreakdownRow {
  key: string;
  label: string;
  figures: UsageFigures;
  runs: number;
  select: UsageRowSelection;
}

export function usageDayRows(dashboard: UsageDashboard): UsageBreakdownRow[] {
  return dashboard.daily.map((bucket) => ({
    key: bucket.day,
    label: bucket.day,
    figures: bucket.figures,
    runs: bucket.runs,
    select: { day: bucket.day },
  }));
}

export function usageProjectRows(dashboard: UsageDashboard): UsageBreakdownRow[] {
  return dashboard.projects.map((bucket) => ({
    key: bucket.project_id,
    label: bucket.project_name,
    figures: bucket.figures,
    runs: bucket.runs,
    select: { projects: [bucket.project_id] },
  }));
}

/** Both axes at once: a model nobody reported would otherwise match every runtime that reported none. */
export function usageEmitterRows(dashboard: UsageDashboard): UsageBreakdownRow[] {
  return dashboard.emitters.map((bucket) => ({
    key: usageEmitterLabel(bucket.emitter),
    label: usageEmitterLabel(bucket.emitter),
    figures: bucket.figures,
    runs: bucket.runs,
    select: {
      runtimes: [usageFacetValue(bucket.emitter.runtime)],
      models: [usageFacetValue(bucket.emitter.model)],
    },
  }));
}

const LIST_AXES = ["projects", "runtimes", "models", "issues"] as const;

function sameList(held: readonly string[], wanted: readonly string[]): boolean {
  return held.length === wanted.length && held.every((value, index) => value === wanted[index]);
}

export function isUsageRowSelected(filters: UsageFilters, row: UsageBreakdownRow): boolean {
  if (row.select.day !== undefined && filters.day !== row.select.day) return false;
  return LIST_AXES.every((axis) => {
    const wanted = row.select[axis];
    return wanted === undefined || sameList(filters[axis], wanted);
  });
}

export function toggleUsageRow(filters: UsageFilters, row: UsageBreakdownRow): UsageFilters {
  const clear = isUsageRowSelected(filters, row);
  const next = { ...filters };
  if (row.select.day !== undefined) next.day = clear ? null : row.select.day;
  for (const axis of LIST_AXES) {
    const wanted = row.select[axis];
    if (wanted !== undefined) next[axis] = clear ? [] : wanted;
  }
  return next;
}

export function usageRowSummary(row: UsageBreakdownRow): string {
  const magnitude = usageTokenMetric(row.figures).value;
  const tokens =
    magnitude === null ? "no tokens reported" : `${formatTokenCount(magnitude)} tokens`;
  const cost =
    row.figures.cost_usd.value === null
      ? "no cost reported"
      : formatCostUsd(row.figures.cost_usd.value);
  return `${row.label}: ${tokens}, ${cost}, ${row.runs} run(s)`;
}
