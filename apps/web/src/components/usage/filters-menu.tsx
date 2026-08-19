import type { UsageFacetOptions, UsageFilters } from "@otomat/domain";
import {
  ConfigMenu,
  ConfigMenuContent,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
} from "@otomat/ui";
import { MultiSelect } from "@web/components/config-menu/multi-select";
import { Select } from "@web/components/config-menu/select";
import {
  activeUsageFilterCount,
  clearedUsageFilters,
  usageIssueOptions,
  usageModelOptions,
  usageProjectOptions,
  usageRuntimeOptions,
  USAGE_PERIOD_LABELS,
  USAGE_PERIOD_OPTIONS,
} from "@web/lib/usage/facets";

const MENU_LABEL = "Usage filters";

export interface UsageFiltersMenuProps {
  filters: UsageFilters;
  options: UsageFacetOptions;
  onChange: (filters: UsageFilters) => void;
}

export function UsageFiltersMenu({ filters, options, onChange }: UsageFiltersMenuProps) {
  const active = activeUsageFilterCount(filters);
  const period = USAGE_PERIOD_LABELS[filters.period];

  return (
    <ConfigMenu>
      <ConfigMenuTrigger
        label={MENU_LABEL}
        summary={active === 0 ? period : `${period} · ${active}`}
        leading={<Icon name="sliders-horizontal" aria-hidden className="shrink-0" />}
      />
      <ConfigMenuContent aria-label={MENU_LABEL}>
        <Select
          label="Period"
          items={USAGE_PERIOD_OPTIONS}
          value={filters.period}
          onChange={(next) => onChange({ ...filters, period: next, day: null })}
        />
        <MultiSelect
          label="Project"
          emptyLabel="All"
          items={usageProjectOptions(options)}
          selected={filters.projects}
          onChange={(projects) => onChange({ ...filters, projects })}
        />
        <MultiSelect
          label="Runtime"
          emptyLabel="All"
          items={usageRuntimeOptions(options)}
          selected={filters.runtimes}
          onChange={(runtimes) => onChange({ ...filters, runtimes })}
        />
        <MultiSelect
          label="Model"
          emptyLabel="All"
          items={usageModelOptions(options)}
          selected={filters.models}
          onChange={(models) => onChange({ ...filters, models })}
        />
        <MultiSelect
          label="Issue"
          emptyLabel="All"
          items={usageIssueOptions(options)}
          selected={filters.issues}
          onChange={(issues) => onChange({ ...filters, issues })}
        />
        {active === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(clearedUsageFilters(filters))}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
