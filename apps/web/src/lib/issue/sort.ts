import { ISSUE_BOARD_COLUMNS, projectIssuePrimaryState, type IssueContract } from "@otomat/domain";

export const ISSUE_SORT_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title" },
] as const;

export type IssueSort = (typeof ISSUE_SORT_OPTIONS)[number]["value"];

export const ISSUE_SORTS: IssueSort[] = ISSUE_SORT_OPTIONS.map((option) => option.value);

/** Linear's 0 means "no priority", so it ranks after Low instead of before Urgent. */
function priorityRank(issue: IssueContract): number {
  const priority = issue.source_priority;
  return priority === null || priority === 0 ? Number.MAX_SAFE_INTEGER : priority;
}

function compare(a: IssueContract, b: IssueContract, sort: IssueSort): number {
  if (sort === "priority") return priorityRank(a) - priorityRank(b);
  if (sort === "status") {
    return (
      ISSUE_BOARD_COLUMNS.indexOf(projectIssuePrimaryState(a).state) -
      ISSUE_BOARD_COLUMNS.indexOf(projectIssuePrimaryState(b).state)
    );
  }
  return a.title.localeCompare(b.title);
}

/** The id breaks every remaining tie, so a group's order never depends on the order the daemon returned. */
export function sortIssues(issues: IssueContract[], sort: IssueSort): IssueContract[] {
  return issues.toSorted((a, b) => compare(a, b, sort) || a.id.localeCompare(b.id));
}
