import {
  Button,
  Icon,
  IssueSourceGlyph,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { CountBadge } from "@web/components/issues/count-badge";
import {
  activeAdvancedFilterCount,
  NO_ADVANCED_FILTERS,
  type AdvancedIssueFilters,
} from "@web/lib/issue-filters";

import { MultiSelect } from "./multi-select";
import { PRIORITY_ITEMS, SOURCE_OPTIONS } from "./options";
import { Select } from "./select";

export function IssuesFilterPopover({
  filters,
  assignees,
  states,
  onChange,
}: {
  filters: AdvancedIssueFilters;
  assignees: string[];
  states: { name: string; color: string }[];
  onChange: (next: AdvancedIssueFilters) => void;
}) {
  const activeCount = activeAdvancedFilterCount(filters);
  const assigneeItems = [
    { value: "all", label: "Anyone" },
    { value: "unassigned", label: "Unassigned" },
    ...assignees.map((name) => ({ value: name, label: name })),
  ];
  const stateItems = states.map((state) => ({
    value: state.name,
    label: state.name,
    color: state.color,
  }));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm">
            <Icon name="wand-2" aria-hidden />
            Filter
            {activeCount > 0 ? <CountBadge count={activeCount} tone="accent" /> : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3">
        <MultiSelect
          label="Sources"
          emptyLabel="Any source"
          items={SOURCE_OPTIONS}
          selected={filters.sources}
          renderLeading={(item) => <IssueSourceGlyph source={item.value} />}
          onChange={(sources) => onChange({ ...filters, sources })}
        />
        {stateItems.length > 0 ? (
          <MultiSelect
            label="Linear state"
            emptyLabel="Any state"
            items={stateItems}
            selected={filters.states}
            renderLeading={(item) => <ColorDot color={item.color} />}
            onChange={(nextStates) => onChange({ ...filters, states: nextStates })}
          />
        ) : null}
        <Select
          label="Assignee"
          items={assigneeItems}
          value={filters.assignee}
          onChange={(assignee) => onChange({ ...filters, assignee })}
        />
        <Select
          label="Priority"
          items={PRIORITY_ITEMS}
          value={filters.priority === "all" ? "all" : String(filters.priority)}
          onChange={(priority) =>
            onChange({
              ...filters,
              priority: priority === "all" ? "all" : Number(priority),
            })
          }
        />
        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange(NO_ADVANCED_FILTERS)}
          >
            Clear filters
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
