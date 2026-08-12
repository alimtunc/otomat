import {
  CLOSED_ISSUE_WORKSPACE,
  type IssueWorkspace,
} from "../contracts/entities/issue-workspace.js";
import { isRunBusy } from "../state-machines/run.js";
import type { IssueExecutionEvidence } from "./issue-execution.js";

/** Only the two explicit closures end a cycle — a confirmed merge (`completed`) or an abandon stamp — and a workspace must never point at a worktree that is gone. */
function holdsWorkspace(row: IssueExecutionEvidence): boolean {
  if (row.worktree_status !== "active") return false;
  return row.run_abandoned_at === null && row.run_status !== "completed";
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
