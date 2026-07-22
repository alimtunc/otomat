import { LINEAR_PRIORITIES, type IssueSource } from "@otomat/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Icon,
  IssueSourceGlyph,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { CountBadge } from "@web/components/issues/count-badge";
import { FOCUS_RING } from "@web/lib/focus";
import {
  activeAdvancedFilterCount,
  NO_ADVANCED_FILTERS,
  type AdvancedIssueFilters,
} from "@web/lib/issue-filters";
import type { ReactNode } from "react";

const SOURCE_OPTIONS: { value: IssueSource; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "github", label: "GitHub" },
  { value: "local", label: "Local" },
];

const PRIORITY_ITEMS = [
  { value: "all", label: "Any priority" },
  ...LINEAR_PRIORITIES.map((priority) => ({
    value: String(priority.value),
    label: priority.label,
  })),
];

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-tertiary">{label}</span>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function MultiSelectDropdown({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-tertiary">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={label}
          className={`flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-foreground ${FOCUS_RING}`}
        >
          <span className="truncate">{summary}</span>
          <Icon name="chevron-down" size="xs" className="text-text-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-(--anchor-width)">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

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
        <MultiSelectDropdown
          label="Sources"
          summary={
            filters.sources.length === 0
              ? "Any source"
              : SOURCE_OPTIONS.filter((option) => filters.sources.includes(option.value))
                  .map((option) => option.label)
                  .join(", ")
          }
        >
          {SOURCE_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={filters.sources.includes(option.value)}
              closeOnClick={false}
              onCheckedChange={() =>
                onChange({
                  ...filters,
                  sources: toggle(filters.sources, option.value),
                })
              }
            >
              <span className="inline-flex items-center gap-2">
                <IssueSourceGlyph source={option.value} />
                {option.label}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </MultiSelectDropdown>
        {states.length > 0 ? (
          <MultiSelectDropdown
            label="Linear state"
            summary={filters.states.length === 0 ? "Any state" : filters.states.join(", ")}
          >
            {states.map((state) => (
              <DropdownMenuCheckboxItem
                key={state.name}
                checked={filters.states.includes(state.name)}
                closeOnClick={false}
                onCheckedChange={() =>
                  onChange({ ...filters, states: toggle(filters.states, state.name) })
                }
              >
                <span className="inline-flex items-center gap-2">
                  <ColorDot color={state.color} />
                  {state.name}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </MultiSelectDropdown>
        ) : null}
        <FilterSelect
          label="Assignee"
          items={assigneeItems}
          value={filters.assignee}
          onChange={(next) => onChange({ ...filters, assignee: next })}
        />
        <FilterSelect
          label="Priority"
          items={PRIORITY_ITEMS}
          value={filters.priority === "all" ? "all" : String(filters.priority)}
          onChange={(next) =>
            onChange({ ...filters, priority: next === "all" ? "all" : Number(next) })
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
