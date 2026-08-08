import type { IssueExecutionEvidence } from "@otomat/domain";
import { and, eq, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, pullRequests, runs, worktrees } from "../schema/index.js";

/** Evidence for the per-issue execution projection; `issue_id` groups the rows the domain reducer consumes. */
export type IssueExecutionEvidenceRow = IssueExecutionEvidence & { issue_id: string };

/**
 * One query returning every run with its worktree and optional pull request for
 * the selected issues, so the daemon projects each issue's execution and
 * workspace state without an N+1. Rows are raw persisted facts;
 * `projectIssueExecution` and `projectIssueWorkspace` own the interpretation.
 */
export function listIssueExecutionEvidence(
  db: Db,
  options: { projectId?: string; issueId?: string } = {},
): IssueExecutionEvidenceRow[] {
  const filters: SQL[] = [];
  if (options.issueId) filters.push(eq(runs.issue_id, options.issueId));
  if (options.projectId) filters.push(eq(issues.project_id, options.projectId));
  return db
    .select({
      issue_id: runs.issue_id,
      run_id: runs.id,
      run_status: runs.status,
      run_created_at: runs.created_at,
      run_branch: runs.branch,
      worktree_status: worktrees.status,
      pr_status: pullRequests.status,
      pr_publication: pullRequests.publication_status,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .leftJoin(worktrees, eq(runs.worktree_id, worktrees.id))
    .leftJoin(pullRequests, eq(pullRequests.run_id, runs.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .all();
}
