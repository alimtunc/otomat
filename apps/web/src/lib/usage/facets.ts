import {
  NO_USAGE_FILTERS,
  USAGE_PERIODS,
  usageFacetValue,
  type UsageEmitter,
  type UsageFacetOptions,
  type UsageFilters,
  type UsagePeriod,
} from "@otomat/domain";

export const USAGE_PERIOD_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
} satisfies Record<UsagePeriod, string>;

export const USAGE_PERIOD_OPTIONS = USAGE_PERIODS.map((value) => ({
  value,
  label: USAGE_PERIOD_LABELS[value],
}));

const UNREPORTED_RUNTIME = "Runtime not reported";
const UNREPORTED_MODEL = "Model not reported";

export interface UsageFacetOption {
  value: string;
  label: string;
}

export function usageEmitterLabel(emitter: UsageEmitter): string {
  return `${emitter.runtime ?? UNREPORTED_RUNTIME} · ${emitter.model ?? UNREPORTED_MODEL}`;
}

function distinct(options: UsageFacetOption[]): UsageFacetOption[] {
  return [...new Map(options.map((option) => [option.value, option])).values()];
}

export function usageRuntimeOptions(options: UsageFacetOptions): UsageFacetOption[] {
  return distinct(
    options.emitters.map((emitter) => ({
      value: usageFacetValue(emitter.runtime),
      label: emitter.runtime ?? UNREPORTED_RUNTIME,
    })),
  );
}

export function usageModelOptions(options: UsageFacetOptions): UsageFacetOption[] {
  return distinct(
    options.emitters.map((emitter) => ({
      value: usageFacetValue(emitter.model),
      label: emitter.model ?? UNREPORTED_MODEL,
    })),
  );
}

export function usageProjectOptions(options: UsageFacetOptions): UsageFacetOption[] {
  return options.projects.map((project) => ({ value: project.id, label: project.name }));
}

export function usageIssueOptions(options: UsageFacetOptions): UsageFacetOption[] {
  return options.issues.map((issue) => ({
    value: issue.id,
    label: issue.identifier === null ? issue.title : `${issue.identifier} · ${issue.title}`,
  }));
}

/** The axes a chip can clear; the period is always set, so it is stated rather than removable. */
export type UsageFacetAxis = "day" | "projects" | "runtimes" | "models" | "issues";

export interface UsageFacetChip {
  axis: UsageFacetAxis;
  value: string;
  label: string;
}

export function activeUsageFilterCount(filters: UsageFilters): number {
  const lists = [filters.projects, filters.runtimes, filters.models, filters.issues];
  return lists.filter((list) => list.length > 0).length + (filters.day === null ? 0 : 1);
}

function chipsFor(
  axis: UsageFacetAxis,
  values: readonly string[],
  options: UsageFacetOption[],
): UsageFacetChip[] {
  return values.map((value) => ({
    axis,
    value,
    label: options.find((option) => option.value === value)?.label ?? value,
  }));
}

export function activeUsageChips(
  filters: UsageFilters,
  options: UsageFacetOptions,
): UsageFacetChip[] {
  return [
    ...(filters.day === null
      ? []
      : [{ axis: "day" as const, value: filters.day, label: filters.day }]),
    ...chipsFor("projects", filters.projects, usageProjectOptions(options)),
    ...chipsFor("runtimes", filters.runtimes, usageRuntimeOptions(options)),
    ...chipsFor("models", filters.models, usageModelOptions(options)),
    ...chipsFor("issues", filters.issues, usageIssueOptions(options)),
  ];
}

export function clearedUsageFilters(filters: UsageFilters): UsageFilters {
  return { ...NO_USAGE_FILTERS, period: filters.period };
}

export function withoutUsageChip(filters: UsageFilters, chip: UsageFacetChip): UsageFilters {
  if (chip.axis === "day") return { ...filters, day: null };
  return { ...filters, [chip.axis]: filters[chip.axis].filter((value) => value !== chip.value) };
}
