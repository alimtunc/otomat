import { asMember, asRecord, normalizedMembers, normalizedSelection } from "@web/lib/coerce";
import {
  NO_ADVANCED_FILTERS,
  parseAdvancedFilters,
  type AdvancedIssueFilters,
} from "@web/lib/issue/filters";
import { ISSUE_GROUPINGS, type IssueGrouping } from "@web/lib/issue/grouping";
import { ISSUE_SORTS, type IssueSort } from "@web/lib/issue/sort";

export const ISSUE_OPTIONAL_COLUMN_OPTIONS = [
  { value: "source", label: "Source" },
  { value: "assignee", label: "Assignee" },
] as const;
export type IssueOptionalColumn = (typeof ISSUE_OPTIONAL_COLUMN_OPTIONS)[number]["value"];
export const ISSUE_OPTIONAL_COLUMNS: readonly IssueOptionalColumn[] =
  ISSUE_OPTIONAL_COLUMN_OPTIONS.map((option) => option.value);

export interface IssuesViewConfig {
  columns?: IssueOptionalColumn[];
  grouping: IssueGrouping;
  sort: IssueSort;
  advanced: AdvancedIssueFilters;
  collapsedGroups: string[];
}

export const DEFAULT_ISSUES_VIEW_CONFIG: IssuesViewConfig = {
  columns: [],
  grouping: "status",
  sort: "priority",
  advanced: NO_ADVANCED_FILTERS,
  collapsedGroups: [],
};

export function parseIssuesViewConfig(value: unknown): IssuesViewConfig {
  const entry = asRecord(value);
  if (entry === null) return DEFAULT_ISSUES_VIEW_CONFIG;
  return {
    columns: normalizedMembers(entry.columns, ISSUE_OPTIONAL_COLUMNS),
    grouping: asMember(entry.grouping, ISSUE_GROUPINGS) ?? DEFAULT_ISSUES_VIEW_CONFIG.grouping,
    sort: asMember(entry.sort, ISSUE_SORTS) ?? DEFAULT_ISSUES_VIEW_CONFIG.sort,
    advanced: parseAdvancedFilters(entry.advanced),
    collapsedGroups: normalizedSelection(entry.collapsedGroups),
  };
}
