import {
  CLOSED_ISSUE_WORKSPACE,
  type IssueWorkspace,
} from "../contracts/entities/issue-workspace.js";
import { isIssueClosed } from "../state-machines/issue.js";
import { isRunBusy } from "../state-machines/run.js";
import type { IssueExecutionEvidence } from "./evidence.js";

/** Only an explicit closure ends a cycle — a confirmed merge (`completed`), an abandon stamp, or a closed issue once its run is at rest. */
export function isCycleClosed(row: IssueExecutionEvidence): boolean {
  if (isIssueClosed(row.issue_status) && !isRunBusy(row.run_status)) return true;
  return row.run_abandoned_at !== null || row.run_status === "completed";
}

export function holdsWorkspace(row: IssueExecutionEvidence): boolean {
  return row.worktree_status === "active" && !isCycleClosed(row);
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
    run_status: best.run_status,
    busy: isRunBusy(best.run_status),
  };
}
