import type { IssueContract, IssueState } from "@otomat/domain";

export const ISSUES_FILTERS = ["all", "active", "backlog"] as const;
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
