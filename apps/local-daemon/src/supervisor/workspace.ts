import { listIssueExecutionEvidence, type Db } from "@otomat/db";
import { projectIssueWorkspace, type IssueWorkspace } from "@otomat/domain";

/** The issue's canonical workspace, projected from the same durable evidence the cockpit reads. */
export function issueWorkspace(db: Db, issueId: string): IssueWorkspace {
  return projectIssueWorkspace(listIssueExecutionEvidence(db, { issueId }));
}

/** The run no longer holds its issue's workspace — merged, aborted or failed — so it cannot take new work. */
export class RunWorkspaceClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunWorkspaceClosedError";
  }
}

/** Refuses before any write when the run is not the current holder of its issue's workspace. */
export function requireOpenWorkspace(db: Db, run: { id: string; issue_id: string }): void {
  const workspace = issueWorkspace(db, run.issue_id);
  if (workspace.state !== "open" || workspace.run_id !== run.id) {
    throw new RunWorkspaceClosedError(
      `run ${run.id} no longer holds the workspace of issue ${run.issue_id}`,
    );
  }
}
