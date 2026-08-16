import { IssueSourceGlyph, StatusGlyph } from "@otomat/ui";
import { ColorDot } from "@web/components/issues/color-dot";
import { MultiSelect } from "@web/components/issues/view-options/multi-select";
import { Select } from "@web/components/issues/view-options/select";
import {
  ISSUE_SOURCE_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import type { AdvancedIssueFilters } from "@web/lib/issue/filters";

export interface IssueFilterSubmenusProps {
  filters: AdvancedIssueFilters;
  options: IssueFilterOptions;
  onChange: (next: AdvancedIssueFilters) => void;
}

export function IssueFilterSubmenus({ filters, options, onChange }: IssueFilterSubmenusProps) {
  const assigneeItems = [
    { value: "all", label: "Anyone" },
    { value: "unassigned", label: "Unassigned" },
    ...options.assignees,
  ];

  return (
    <>
      <MultiSelect
        label="Status"
        emptyLabel="Any status"
        items={ISSUE_STATUS_OPTIONS}
        selected={filters.statuses}
        renderLeading={(item) => <StatusGlyph kind="issue" status={item.value} />}
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
          renderLeading={(item) => <ColorDot color={item.color ?? null} />}
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
          onChange({ ...filters, priority: priority === "all" ? "all" : Number(priority) })
        }
      />
    </>
  );
}
