import { ISSUE_STATES, type IssueContract, type IssueState } from "@otomat/domain";

// blocked/canceled are hidden per the prototype board; the List layout still shows them.
const HIDDEN_COLUMNS = new Set<IssueState>(["blocked", "canceled"]);
export const BOARD_COLUMNS = ISSUE_STATES.filter((status) => !HIDDEN_COLUMNS.has(status));

/** Live execution wins the card's column (Running/Reviewing/PR open); otherwise it falls back to the source status. */
export function boardColumnFor(issue: IssueContract): IssueState {
  return issue.execution.state === "none" ? issue.status : issue.execution.state;
}

/** When execution took over the column, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueContract): IssueState | null {
  if (boardColumnFor(issue) === issue.status || issue.source_state_name !== null) return null;
  return issue.status;
}

export interface BoardColumn {
  status: IssueState;
  issues: IssueContract[];
}

/** The board columns that actually hold cards; an empty column is dropped so the board stays compact. */
export function visibleBoardColumns(issues: IssueContract[]): BoardColumn[] {
  return BOARD_COLUMNS.map((status) => ({
    status,
    issues: issues.filter((issue) => boardColumnFor(issue) === status),
  })).filter((column) => column.issues.length > 0);
}
