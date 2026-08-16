import { asMember, asRecord, normalizedSelection } from "@web/lib/coerce";
import {
  NO_ADVANCED_FILTERS,
  parseAdvancedFilters,
  type AdvancedIssueFilters,
} from "@web/lib/issue/filters";
import { ISSUE_GROUPINGS, type IssueGrouping } from "@web/lib/issue/grouping";
import { ISSUE_SORTS, type IssueSort } from "@web/lib/issue/sort";

export interface IssuesViewConfig {
  grouping: IssueGrouping;
  sort: IssueSort;
  advanced: AdvancedIssueFilters;
  collapsedGroups: string[];
}

export const DEFAULT_ISSUES_VIEW_CONFIG: IssuesViewConfig = {
  grouping: "status",
  sort: "synced",
  advanced: NO_ADVANCED_FILTERS,
  collapsedGroups: [],
};

export function parseIssuesViewConfig(value: unknown): IssuesViewConfig {
  const entry = asRecord(value);
  if (entry === null) return DEFAULT_ISSUES_VIEW_CONFIG;
  return {
    grouping: asMember(entry.grouping, ISSUE_GROUPINGS) ?? DEFAULT_ISSUES_VIEW_CONFIG.grouping,
    sort: asMember(entry.sort, ISSUE_SORTS) ?? DEFAULT_ISSUES_VIEW_CONFIG.sort,
    advanced: parseAdvancedFilters(entry.advanced),
    collapsedGroups: normalizedSelection(entry.collapsedGroups),
  };
}
