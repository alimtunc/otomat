import type { IssueBoardColumn, IssueExecution } from "../contracts/entities/issue-execution.js";
import { isIssueTerminal, type IssueState } from "../state-machines/issue.js";

/** A terminal source status outranks execution: the tracker has closed the issue, and what its runs left behind stays readable on the issue itself. */
export function projectIssueBoardColumn(issue: {
  status: IssueState;
  execution: IssueExecution;
}): IssueBoardColumn {
  if (isIssueTerminal(issue.status) || issue.execution.state === "none") return issue.status;
  return issue.execution.state;
}
