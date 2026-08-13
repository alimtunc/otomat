import type { IssueContract, IssueState } from "@otomat/domain";

/** Live execution wins the card's column (Running/Reviewing/PR open); otherwise it falls back to the source status. */
export function boardColumnFor(issue: IssueContract): IssueState {
  return issue.execution.state === "none" ? issue.status : issue.execution.state;
}

/** When execution took over the column, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueContract): IssueState | null {
  if (boardColumnFor(issue) === issue.status || issue.source_state_name !== null) return null;
  return issue.status;
}
