import type { IssueExecutionEvidence } from "#domain/projections/evidence";

// Runs are inserted without an explicit timestamp, so the stored shape is SQLite's CURRENT_TIMESTAMP, not ISO-8601.
export const AT = (day: string) => `2026-01-0${day} 00:00:00`;

export function issueExecutionEvidence(
  over: Partial<IssueExecutionEvidence> & { run_id: string },
): IssueExecutionEvidence {
  return {
    issue_status: "ready",
    run_status: "review_ready",
    run_created_at: AT("1"),
    run_branch: `otomat/run/${over.run_id}`,
    run_abandoned_at: null,
    worktree_status: "active",
    halted_step: null,
    pr_status: null,
    pr_publication: null,
    adopted_pr_status: null,
    ...over,
  };
}
