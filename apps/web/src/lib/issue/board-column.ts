import type { IssueBoardColumn, IssueContract, IssueState } from "@otomat/domain";

/** Local execution wins the card's column (Running/Failed/Reviewing/PR open); otherwise it falls back to the source status. */
export function boardColumnFor(issue: IssueContract): IssueBoardColumn {
  return issue.execution.state === "none" ? issue.status : issue.execution.state;
}

/** When execution took over the column, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueContract): IssueState | null {
  if (boardColumnFor(issue) === issue.status || issue.source_state_name !== null) return null;
  return issue.status;
}
