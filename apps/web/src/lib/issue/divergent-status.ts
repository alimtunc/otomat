import {
  projectIssuePrimaryState,
  type IssuePrimaryStateInput,
  type IssueState,
  type IssueSummary,
} from "@otomat/domain";

export function waitSupersedesRunning(issue: IssuePrimaryStateInput): boolean {
  return issue.status === "running" && projectIssuePrimaryState(issue).state === "awaiting_input";
}

/** When execution won the primary state, the source status is otherwise lost — surface it, unless a Linear mirror already shows it in the header. */
export function divergentSourceStatus(issue: IssueSummary): IssueState | null {
  if (
    projectIssuePrimaryState(issue).state === issue.status ||
    issue.source_state_name !== null ||
    waitSupersedesRunning(issue)
  ) {
    return null;
  }
  return issue.status;
}
