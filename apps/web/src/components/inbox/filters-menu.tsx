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
  activeInboxEntryFilterCount,
  INBOX_STATE_OPTIONS,
  NO_INBOX_ENTRY_FILTERS,
  type InboxEntryFilterOptions,
  type InboxEntryFilters,
} from "@web/lib/inbox/filters";

const MENU_LABEL = "Filters";

export interface InboxFiltersMenuProps {
  filters: InboxEntryFilters;
  options: InboxEntryFilterOptions;
  onChange: (filters: InboxEntryFilters) => void;
}

export function InboxFiltersMenu({ filters, options, onChange }: InboxFiltersMenuProps) {
  const active = activeInboxEntryFilterCount(filters);

  return (
    <ConfigMenu>
      <ConfigMenuTrigger
        label={MENU_LABEL}
        summary={active === 0 ? "Open only" : `${active} active`}
        leading={<Icon name="sliders-horizontal" aria-hidden className="shrink-0" />}
      />
      <ConfigMenuContent aria-label={MENU_LABEL}>
        <Select
          label="State"
          items={INBOX_STATE_OPTIONS}
          value={filters.state}
          onChange={(state) => onChange({ ...filters, state })}
        />
        <MultiSelect
          label="Type"
          emptyLabel="Every type"
          items={options.kinds}
          selected={filters.kinds}
          onChange={(kinds) => onChange({ ...filters, kinds })}
        />
        <MultiSelect
          label="Project"
          emptyLabel="Every project"
          items={options.projects}
          selected={filters.projects}
          onChange={(projects) => onChange({ ...filters, projects })}
        />
        {active === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(NO_INBOX_ENTRY_FILTERS)}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
