import type { IssueExecution, IssueExecutionState } from "../contracts/entities/issue-execution.js";
import type { IssueWorkspace } from "../contracts/entities/issue-workspace.js";
import { isIssueClosed, type IssueState } from "../state-machines/issue.js";

/** The axis an issue's current state was read from: its business/source status, or the execution of its canonical workspace. */
export type IssuePrimaryState =
  | { axis: "status"; state: IssueState }
  | { axis: "execution"; state: Exclude<IssueExecutionState, "none">; run_id: string };

export interface IssuePrimaryStateInput {
  status: IssueState;
  execution: IssueExecution;
  workspace: IssueWorkspace;
}

export type OpenCycleExecution = Exclude<IssueExecution, { state: "none" }>;

export function projectOpenCycleExecution(
  issue: IssuePrimaryStateInput,
): OpenCycleExecution | null {
  if (issue.workspace.state === "closed" || issue.execution.state === "none") return null;
  return issue.execution;
}

/** A closed business status outranks every run; below it an open cycle outranks the status, and a closed cycle hands it back, so an old failure or review never reads as current. */
export function projectIssuePrimaryState(issue: IssuePrimaryStateInput): IssuePrimaryState {
  if (isIssueClosed(issue.status)) return { axis: "status", state: issue.status };
  const execution = projectOpenCycleExecution(issue);
  if (execution === null) return { axis: "status", state: issue.status };
  return { axis: "execution", state: execution.state, run_id: execution.run_id };
}
