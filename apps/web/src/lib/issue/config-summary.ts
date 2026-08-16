import {
  ISSUE_SOURCE_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  type IssueFilterOptions,
} from "@web/lib/issue/filter-options";
import { activeAdvancedFilterCount, type AdvancedIssueFilters } from "@web/lib/issue/filters";
import { ISSUE_GROUPING_OPTIONS } from "@web/lib/issue/grouping";
import { ISSUE_SORT_OPTIONS } from "@web/lib/issue/sort";
import type { IssuesViewConfig } from "@web/lib/issue/view-config";

export interface IssuesConfigEntry {
  label: string;
  value: string;
}

type LabelledOptions = readonly { value: string; label: string }[];

function labelOf(value: string, items: LabelledOptions): string {
  return items.find((item) => item.value === value)?.label ?? value;
}

export function issuesConfigSegments(config: IssuesViewConfig): string[] {
  const count = activeAdvancedFilterCount(config.advanced);
  return [
    labelOf(config.grouping, ISSUE_GROUPING_OPTIONS),
    labelOf(config.sort, ISSUE_SORT_OPTIONS),
    ...(count === 0 ? [] : [count === 1 ? "1 filter" : `${count} filters`]),
  ];
}

function filterEntries(
  filters: AdvancedIssueFilters,
  options: IssueFilterOptions,
): IssuesConfigEntry[] {
  const axis = (
    label: string,
    selected: readonly string[],
    items: LabelledOptions,
  ): IssuesConfigEntry[] =>
    selected.length === 0
      ? []
      : [{ label, value: selected.map((value) => labelOf(value, items)).join(", ") }];

  return [
    ...axis("Status", filters.statuses, ISSUE_STATUS_OPTIONS),
    ...axis("Sources", filters.sources, ISSUE_SOURCE_OPTIONS),
    ...axis("Labels", filters.labels, options.labels),
    ...axis("Project", filters.projects, options.projects),
    ...axis("Linear state", filters.linearStates, options.linearStates),
    ...(filters.assignee === "all"
      ? []
      : [
          {
            label: "Assignee",
            value: filters.assignee === "unassigned" ? "Unassigned" : filters.assignee,
          },
        ]),
    ...(filters.priority === "all"
      ? []
      : [{ label: "Priority", value: labelOf(String(filters.priority), PRIORITY_OPTIONS) }]),
  ];
}

export function issuesConfigDetails(
  config: IssuesViewConfig,
  options: IssueFilterOptions,
): IssuesConfigEntry[] {
  return [
    { label: "Group", value: labelOf(config.grouping, ISSUE_GROUPING_OPTIONS) },
    { label: "Sort", value: labelOf(config.sort, ISSUE_SORT_OPTIONS) },
    ...filterEntries(config.advanced, options),
  ];
}
