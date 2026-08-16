import {
  ISSUE_BOARD_COLUMNS,
  projectIssueBoardColumn,
  type IssueBoardColumn,
  type IssueContract,
  type IssueSource,
} from "@otomat/domain";
import { asRecord, asString, normalizedMembers, normalizedSelection } from "@web/lib/coerce";
import { ISSUE_SOURCES, knownPriority } from "@web/lib/issue/filter-options";

export const ISSUES_FILTERS = ["all", "active", "backlog"] as const;
export type IssuesFilter = (typeof ISSUES_FILTERS)[number];

/** The columns holding work someone can pick up; the pills read the board's own column so they never disagree with it. */
const ACTIVE_COLUMNS = new Set<IssueBoardColumn>([
  "ready",
  "running",
  "failed",
  "reviewing",
  "pr_open",
]);

export function applyIssuesFilter(issues: IssueContract[], filter: IssuesFilter): IssueContract[] {
  if (filter === "active") {
    return issues.filter((issue) => ACTIVE_COLUMNS.has(projectIssueBoardColumn(issue)));
  }
  if (filter === "backlog") {
    return issues.filter((issue) => projectIssueBoardColumn(issue) === "backlog");
  }
  return issues;
}

/** Popover filters composing with the status pills; empty lists and "all" mean the axis is off. */
export interface AdvancedIssueFilters {
  sources: IssueSource[];
  statuses: IssueBoardColumn[];
  linearStates: string[];
  labels: string[];
  projects: string[];
  assignee: "all" | "unassigned" | (string & {});
  priority: "all" | number;
}

export const NO_ADVANCED_FILTERS: AdvancedIssueFilters = {
  sources: [],
  statuses: [],
  linearStates: [],
  labels: [],
  projects: [],
  assignee: "all",
  priority: "all",
};

export function activeAdvancedFilterCount(filters: AdvancedIssueFilters): number {
  const lists = [
    filters.sources,
    filters.statuses,
    filters.linearStates,
    filters.labels,
    filters.projects,
  ];
  return (
    lists.filter((list) => list.length > 0).length +
    [filters.assignee, filters.priority].filter((axis) => axis !== "all").length
  );
}

function matchesAssignee(
  issue: IssueContract,
  assignee: AdvancedIssueFilters["assignee"],
): boolean {
  if (assignee === "all") return true;
  if (assignee === "unassigned") return issue.source_assignee_name === null;
  return issue.source_assignee_name === assignee;
}

function matchesLabels(issue: IssueContract, labels: ReadonlySet<string>): boolean {
  if (labels.size === 0) return true;
  return (issue.source_labels ?? []).some((label) => labels.has(label.name));
}

export function applyAdvancedFilters(
  issues: IssueContract[],
  filters: AdvancedIssueFilters,
): IssueContract[] {
  const sources = new Set(filters.sources);
  const statuses = new Set(filters.statuses);
  const linearStates = new Set(filters.linearStates);
  const labels = new Set(filters.labels);
  const projects = new Set(filters.projects);
  return issues.filter(
    (issue) =>
      (sources.size === 0 || sources.has(issue.source)) &&
      (statuses.size === 0 || statuses.has(projectIssueBoardColumn(issue))) &&
      (linearStates.size === 0 ||
        (issue.source_state_name !== null && linearStates.has(issue.source_state_name))) &&
      (projects.size === 0 || projects.has(issue.project_id)) &&
      matchesLabels(issue, labels) &&
      matchesAssignee(issue, filters.assignee) &&
      (filters.priority === "all" || issue.source_priority === filters.priority),
  );
}

export function parseAdvancedFilters(value: unknown): AdvancedIssueFilters {
  const entry = asRecord(value);
  if (entry === null) return NO_ADVANCED_FILTERS;
  const assignee = asString(entry.assignee);
  return {
    sources: normalizedMembers(entry.sources, ISSUE_SOURCES),
    statuses: normalizedMembers(entry.statuses, ISSUE_BOARD_COLUMNS),
    linearStates: normalizedSelection(entry.linearStates),
    labels: normalizedSelection(entry.labels),
    projects: normalizedSelection(entry.projects),
    assignee: assignee === null || assignee === "all" ? "all" : assignee,
    priority: knownPriority(entry.priority) ?? "all",
  };
}
