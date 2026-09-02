import {
  isPullRequestLive,
  type HaltedStepEvidence,
  type IssueExecutionEvidence,
  type PullRequestState,
} from "@otomat/domain";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, pullRequests, runs, stepRuns, worktrees } from "../schema/index.js";

/** Evidence for the per-issue execution projection; `issue_id` groups the rows the domain reducer consumes. */
export type IssueExecutionEvidenceRow = IssueExecutionEvidence & { issue_id: string };

function scopeFilters(options: { projectId?: string; issueId?: string }): SQL[] {
  const filters: SQL[] = [];
  if (options.issueId) filters.push(eq(runs.issue_id, options.issueId));
  if (options.projectId) filters.push(eq(issues.project_id, options.projectId));
  return filters;
}

/** The last step of each run that failed or went stale — the step a reader is sent to, not the ones a fail-fast cascade canceled. */
function lastHaltedSteps(db: Db, filters: SQL[]): Map<string, HaltedStepEvidence> {
  const rows = db
    .select({ run_id: stepRuns.run_id, id: stepRuns.id, name: stepRuns.name })
    .from(stepRuns)
    .innerJoin(runs, eq(stepRuns.run_id, runs.id))
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .where(and(inArray(stepRuns.status, ["failed", "stale"]), ...filters))
    .orderBy(asc(stepRuns.idx))
    .all();
  return new Map(rows.map((row) => [row.run_id, { id: row.id, name: row.name }]));
}

/** The adopted pull request that still stands for each issue: any live one outranks every settled one. */
function adoptedPullRequests(db: Db, filters: SQL[]): Map<string, PullRequestState> {
  const rows = db
    .select({ issue_id: issues.id, status: pullRequests.status })
    .from(pullRequests)
    .innerJoin(runs, eq(runs.issue_id, pullRequests.issue_id))
    .innerJoin(issues, eq(pullRequests.issue_id, issues.id))
    .where(and(isNull(pullRequests.run_id), isNull(pullRequests.detached_at), ...filters))
    .orderBy(asc(pullRequests.created_at))
    .all();
  const standing = new Map<string, PullRequestState>();
  for (const row of rows) {
    const held = standing.get(row.issue_id);
    if (held === undefined || !isPullRequestLive(held)) {
      standing.set(row.issue_id, row.status);
    }
  }
  return standing;
}

/**
 * One query per fact returning every run with its worktree, optional pull
 * request and last halted step for the selected issues, so the daemon projects
 * each issue's execution and workspace state without an N+1. Rows are raw
 * persisted facts; `projectIssueExecution` and `projectIssueWorkspace` own the
 * interpretation.
 */
export function listIssueExecutionEvidence(
  db: Db,
  options: { projectId?: string; issueId?: string } = {},
): IssueExecutionEvidenceRow[] {
  const filters = scopeFilters(options);
  const halted = lastHaltedSteps(db, filters);
  const adopted = adoptedPullRequests(db, filters);
  return db
    .select({
      issue_id: runs.issue_id,
      issue_status: issues.status,
      run_id: runs.id,
      run_status: runs.status,
      run_created_at: runs.created_at,
      run_branch: runs.branch,
      run_abandoned_at: runs.abandoned_at,
      worktree_status: worktrees.status,
      pr_status: pullRequests.status,
      pr_publication: pullRequests.publication_status,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .leftJoin(worktrees, eq(runs.worktree_id, worktrees.id))
    .leftJoin(pullRequests, eq(pullRequests.run_id, runs.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .all()
    .map((row) => ({
      ...row,
      halted_step: halted.get(row.run_id) ?? null,
      adopted_pr_status: adopted.get(row.issue_id) ?? null,
    }));
}
