import type { IssueExecutionEvidence } from "@otomat/domain";
import { and, eq, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, pullRequests, runs } from "../schema/index.js";

/** Evidence for the per-issue execution projection; `issue_id` groups the rows the domain reducer consumes. */
export type IssueExecutionEvidenceRow = IssueExecutionEvidence & { issue_id: string };

/** A pull request counts as "open" only once really created on the provider and not yet merged or closed. */
function isOpenPr(publication: string | null, status: string | null): boolean {
  return publication === "created" && (status === "open" || status === "draft");
}

/**
 * One query returning every run (with its optional pull-request status) for the
 * selected issues, so the daemon projects each issue's execution state without
 * an N+1. Terminal runs are included; the domain reducer filters them.
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
      pr_status: pullRequests.status,
      pr_publication: pullRequests.publication_status,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .leftJoin(pullRequests, eq(pullRequests.run_id, runs.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .all()
    .map((row) => ({
      issue_id: row.issue_id,
      run_id: row.run_id,
      run_status: row.run_status,
      run_created_at: row.run_created_at,
      pr_open: isOpenPr(row.pr_publication, row.pr_status),
    }));
}
