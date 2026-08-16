import { projectIssuePrimaryState, type IssueContract, type IssueState } from "@otomat/domain";

/** When execution won the primary state, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueContract): IssueState | null {
  if (projectIssuePrimaryState(issue).state === issue.status || issue.source_state_name !== null) {
    return null;
  }
  return issue.status;
}
