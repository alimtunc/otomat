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
  activeInboxFilterCount,
  INBOX_ASSIGNMENT_OPTIONS,
  INBOX_LINK_OPTIONS,
  NO_INBOX_FILTERS,
  type InboxFilters,
} from "@web/lib/pull-request/inbox/filters";
import type { InboxFilterOptions } from "@web/lib/pull-request/inbox/options";

const MENU_LABEL = "Filters";

export interface ReviewInboxFiltersProps {
  filters: InboxFilters;
  options: InboxFilterOptions;
  onChange: (filters: InboxFilters) => void;
}

export function ReviewInboxFilters({ filters, options, onChange }: ReviewInboxFiltersProps) {
  const active = activeInboxFilterCount(filters);

  return (
    <ConfigMenu>
      <ConfigMenuTrigger
        label={MENU_LABEL}
        summary={active === 0 ? "No filter" : `${active} active`}
        leading={<Icon name="sliders-horizontal" aria-hidden className="shrink-0" />}
      />
      <ConfigMenuContent aria-label={MENU_LABEL}>
        <MultiSelect
          label="Repository"
          emptyLabel="All"
          items={options.repositories}
          selected={filters.repositories}
          onChange={(repositories) => onChange({ ...filters, repositories })}
        />
        <MultiSelect
          label="Author"
          emptyLabel="Anyone"
          items={options.authors}
          selected={filters.authors}
          onChange={(authors) => onChange({ ...filters, authors })}
        />
        <MultiSelect
          label="State"
          emptyLabel="Draft and open"
          items={options.states}
          selected={filters.states}
          onChange={(states) => onChange({ ...filters, states })}
        />
        <Select
          label="Review requested from"
          items={INBOX_ASSIGNMENT_OPTIONS}
          value={filters.assignment}
          onChange={(assignment) => onChange({ ...filters, assignment })}
        />
        <Select
          label="Issue"
          items={INBOX_LINK_OPTIONS}
          value={filters.link}
          onChange={(link) => onChange({ ...filters, link })}
        />
        {active === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(NO_INBOX_FILTERS)}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
