import {
  CLOSED_ISSUE_WORKSPACE,
  type IssueWorkspace,
} from "../contracts/entities/issue-workspace.js";
import { isRunBusy, isRunTerminal } from "../state-machines/run.js";
import type { IssueExecutionEvidence } from "./issue-execution.js";

/**
 * A run holds its issue's workspace while it is not terminal and still owns an
 * active worktree. Both halves matter: a merge drives the run terminal *and*
 * releases the worktree, and a worktree released any other way must not leave a
 * workspace pointing at a directory that is gone.
 */
function holdsWorkspace(row: IssueExecutionEvidence): boolean {
  return !isRunTerminal(row.run_status) && row.worktree_status === "active";
}

function outranks(candidate: IssueExecutionEvidence, best: IssueExecutionEvidence): boolean {
  if (candidate.run_created_at !== best.run_created_at) {
    return candidate.run_created_at > best.run_created_at;
  }
  return candidate.run_id > best.run_id;
}

/** Reduce an issue's run evidence to the one workspace new work may reuse; no holder projects to `closed`. */
export function projectIssueWorkspace(rows: readonly IssueExecutionEvidence[]): IssueWorkspace {
  let best: IssueExecutionEvidence | null = null;
  for (const row of rows) {
    if (!holdsWorkspace(row)) continue;
    if (best === null || outranks(row, best)) best = row;
  }
  if (best === null) return CLOSED_ISSUE_WORKSPACE;
  return {
    state: "open",
    run_id: best.run_id,
    branch: best.run_branch,
    busy: isRunBusy(best.run_status),
  };
}
