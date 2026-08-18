import { listIssueExecutionEvidence, listPullRequestsForProject, type Db } from "@otomat/db";
import { isPullRequestLive, isReviewOpen, type ReviewQueueEntry } from "@otomat/domain";

/** A pull request Otomat opened is reviewed through its run, so only adopted ones stand on their own here. */
function adoptedEntries(db: Db, projectId: string): ReviewQueueEntry[] {
  return listPullRequestsForProject(db, projectId).flatMap((row) =>
    row.origin === "imported" && isPullRequestLive(row.status)
      ? [
          {
            kind: "pull_request" as const,
            id: row.id,
            issue_id: row.issue_id,
            label: row.number === null ? row.title : `#${row.number} ${row.title}`,
            branch: row.head_ref,
            provenance: row.provenance,
          },
        ]
      : [],
  );
}

/**
 * Everything genuinely waiting for a review in one project: runs resting on
 * their diff, and adopted pull requests. A merged or closed pull request removes
 * its run from the list without touching that run's own state or history.
 */
export function readReviewQueue(db: Db, projectId: string): ReviewQueueEntry[] {
  const runs = listIssueExecutionEvidence(db, { projectId }).flatMap((row) =>
    row.run_status === "review_ready" && isReviewOpen(row)
      ? [
          {
            kind: "run" as const,
            id: row.run_id,
            issue_id: row.issue_id,
            label: `Run ${row.run_id.slice(0, 7)}`,
            branch: row.run_branch,
            provenance: null,
          },
        ]
      : [],
  );
  return [...runs, ...adoptedEntries(db, projectId)];
}
