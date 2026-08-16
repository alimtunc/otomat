import { projectIssueBoardColumn, type IssueContract, type IssueState } from "@otomat/domain";

/** When execution took over the column, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueContract): IssueState | null {
  if (projectIssueBoardColumn(issue) === issue.status || issue.source_state_name !== null) {
    return null;
  }
  return issue.status;
}
