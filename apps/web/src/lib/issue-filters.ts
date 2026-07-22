import type { IssueContract, IssueSource, IssueState } from "@otomat/domain";

const ISSUES_FILTERS = ["all", "active", "backlog"] as const;
export type IssuesFilter = (typeof ISSUES_FILTERS)[number];

export function isIssuesFilter(value: string): value is IssuesFilter {
  return (ISSUES_FILTERS as readonly string[]).includes(value);
}

const ACTIVE_STATES = new Set<IssueState>(["ready", "running", "reviewing", "pr_open"]);

export function applyIssuesFilter(issues: IssueContract[], filter: IssuesFilter): IssueContract[] {
  if (filter === "active") return issues.filter((issue) => ACTIVE_STATES.has(issue.status));
  if (filter === "backlog") return issues.filter((issue) => issue.status === "backlog");
  return issues;
}

/** Popover filters composing with the status pills; empty lists and "all" mean the axis is off. */
export interface AdvancedIssueFilters {
  sources: IssueSource[];
  states: string[];
  assignee: "all" | "unassigned" | (string & {});
  priority: "all" | number;
}

export const NO_ADVANCED_FILTERS: AdvancedIssueFilters = {
  sources: [],
  states: [],
  assignee: "all",
  priority: "all",
};

export function activeAdvancedFilterCount(filters: AdvancedIssueFilters): number {
  return (
    (filters.sources.length > 0 ? 1 : 0) +
    (filters.states.length > 0 ? 1 : 0) +
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

export function applyAdvancedFilters(
  issues: IssueContract[],
  filters: AdvancedIssueFilters,
): IssueContract[] {
  const sources = new Set(filters.sources);
  const states = new Set(filters.states);
  return issues.filter(
    (issue) =>
      (sources.size === 0 || sources.has(issue.source)) &&
      (states.size === 0 ||
        (issue.source_state_name !== null && states.has(issue.source_state_name))) &&
      matchesAssignee(issue, filters.assignee) &&
      (filters.priority === "all" || issue.source_priority === filters.priority),
  );
}

/** Distinct assignee names across the loaded issues, sorted for stable options. */
export function assigneeOptions(issues: IssueContract[]): string[] {
  const names = new Set<string>();
  for (const issue of issues) {
    if (issue.source_assignee_name !== null) names.add(issue.source_assignee_name);
  }
  return [...names].toSorted((a, b) => a.localeCompare(b));
}

/** Distinct Linear states across the loaded issues, with the first color seen per name. */
export function stateOptions(issues: IssueContract[]): { name: string; color: string }[] {
  const colors = new Map<string, string>();
  for (const issue of issues) {
    if (issue.source_state_name !== null && !colors.has(issue.source_state_name)) {
      colors.set(issue.source_state_name, issue.source_state_color ?? "var(--text-tertiary)");
    }
  }
  return [...colors.entries()]
    .map(([name, color]) => ({ name, color }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}
