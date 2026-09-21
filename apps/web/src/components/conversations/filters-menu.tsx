import {
  ConfigMenu,
  ConfigMenuCheck,
  ConfigMenuContent,
  ConfigMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
} from "@otomat/ui";
import { MultiSelect } from "@web/components/config-menu/multi-select";
import { Select } from "@web/components/config-menu/select";
import {
  activeConversationFilterCount,
  CONVERSATION_STATE_OPTIONS,
  NO_CONVERSATION_FILTERS,
  type ConversationFilters,
  type ConversationProjectOption,
} from "@web/lib/conversations/filters";

const MENU_LABEL = "Filters";

export interface ConversationFiltersMenuProps {
  filters: ConversationFilters;
  projects: ConversationProjectOption[];
  onChange: (filters: ConversationFilters) => void;
}

export function ConversationFiltersMenu({
  filters,
  projects,
  onChange,
}: ConversationFiltersMenuProps) {
  const active = activeConversationFilterCount(filters);

  return (
    <ConfigMenu>
      <ConfigMenuTrigger
        label={MENU_LABEL}
        summary={active === 0 ? "All" : `${active} active`}
        leading={<Icon name="sliders-horizontal" aria-hidden className="shrink-0" />}
      />
      <ConfigMenuContent aria-label={MENU_LABEL}>
        <Select
          label="State"
          items={CONVERSATION_STATE_OPTIONS}
          value={filters.state}
          onChange={(state) => onChange({ ...filters, state })}
        />
        <ConfigMenuCheck
          label="Unread only"
          checked={filters.unread}
          onCheckedChange={() => onChange({ ...filters, unread: !filters.unread })}
        />
        <MultiSelect
          label="Project"
          emptyLabel="Every project"
          items={projects}
          selected={filters.projects}
          onChange={(selected) => onChange({ ...filters, projects: selected })}
        />
        {active === 0 ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(NO_CONVERSATION_FILTERS)}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </ConfigMenuContent>
    </ConfigMenu>
  );
}
