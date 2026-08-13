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
  ISSUE_SOURCE_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type IssueFilterOption,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import {
  activeAdvancedFilterCount,
  NO_ADVANCED_FILTERS,
  type AdvancedIssueFilters,
} from "@web/lib/issue/filters";

import { MultiSelect } from "./multi-select";
import { Select } from "./select";

function colorDot(item: IssueFilterOption) {
  return <ColorDot color={item.color ?? null} />;
}

export interface IssuesFilterPopoverProps {
  filters: AdvancedIssueFilters;
  options: IssueFilterOptions;
  onChange: (next: AdvancedIssueFilters) => void;
}

export function IssuesFilterPopover({ filters, options, onChange }: IssuesFilterPopoverProps) {
  const activeCount = activeAdvancedFilterCount(filters);
  const assigneeItems = [
    { value: "all", label: "Anyone" },
    { value: "unassigned", label: "Unassigned" },
    ...options.assignees,
  ];

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
      <PopoverContent
        align="end"
        className="flex max-h-[70vh] w-64 flex-col gap-3 overflow-y-auto p-3"
      >
        <MultiSelect
          label="Status"
          emptyLabel="Any status"
          items={ISSUE_STATUS_OPTIONS}
          selected={filters.statuses}
          onChange={(statuses) => onChange({ ...filters, statuses })}
        />
        <MultiSelect
          label="Sources"
          emptyLabel="Any source"
          items={ISSUE_SOURCE_OPTIONS}
          selected={filters.sources}
          renderLeading={(item) => <IssueSourceGlyph source={item.value} />}
          onChange={(sources) => onChange({ ...filters, sources })}
        />
        {options.labels.length > 0 ? (
          <MultiSelect
            label="Labels"
            emptyLabel="Any label"
            items={options.labels}
            selected={filters.labels}
            renderLeading={colorDot}
            onChange={(labels) => onChange({ ...filters, labels })}
          />
        ) : null}
        <MultiSelect
          label="Project"
          emptyLabel="Any project"
          items={options.projects}
          selected={filters.projects}
          onChange={(projects) => onChange({ ...filters, projects })}
        />
        {options.linearStates.length > 0 ? (
          <MultiSelect
            label="Linear state"
            emptyLabel="Any state"
            items={options.linearStates}
            selected={filters.linearStates}
            renderLeading={colorDot}
            onChange={(linearStates) => onChange({ ...filters, linearStates })}
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
          items={PRIORITY_OPTIONS}
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
