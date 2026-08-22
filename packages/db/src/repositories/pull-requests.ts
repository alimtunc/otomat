import { PULL_REQUEST_PUBLICATION_ACTIVE_STATES } from "@otomat/domain";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, pullRequests, repositories } from "../schema/index.js";
import { touch } from "./touch.js";

export const LIVE_PULL_REQUEST_STATES = ["draft", "open"] as const;

export type NewPullRequest = typeof pullRequests.$inferInsert;
export type PullRequestRow = typeof pullRequests.$inferSelect;
export type PullRequestPatch = Partial<
  Pick<
    PullRequestRow,
    | "provider"
    | "origin"
    | "provenance"
    | "author_login"
    | "review_decision"
    | "checks_state"
    | "mergeable"
    | "requested_reviewers"
    | "provider_updated_at"
    | "synced_at"
    | "repository_id"
    | "number"
    | "node_id"
    | "url"
    | "status"
    | "publication_status"
    | "failed_phase"
    | "title"
    | "body"
    | "head_ref"
    | "base_ref"
    | "head_sha"
    | "base_sha"
    | "commit_subject"
    | "commit_body"
    | "generator_runtime"
    | "generator_model"
    | "generator_effort"
    | "published_head_sha"
    | "published_diff_sha"
    | "attached_at"
    | "attached_by"
    | "attachment_evidence"
    | "detached_at"
    | "error_code"
    | "error_message"
  >
>;

export function insertPullRequest(db: Db, value: NewPullRequest): void {
  db.insert(pullRequests).values(value).run();
}

export function getPullRequest(db: Db, id: string): PullRequestRow | undefined {
  return db.select().from(pullRequests).where(eq(pullRequests.id, id)).get();
}

/** The row only while it is attached: once detached it is history and resolves as absent. */
export function getAttachedPullRequest(db: Db, id: string): PullRequestRow | undefined {
  return db
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.id, id), isNull(pullRequests.detached_at)))
    .get();
}

export function getPullRequestForRun(db: Db, runId: string): PullRequestRow | undefined {
  return db.select().from(pullRequests).where(eq(pullRequests.run_id, runId)).get();
}

/** Every non-detached pull request of one issue — Otomat-opened and adopted alike — oldest first. */
export function listPullRequestsForIssue(db: Db, issueId: string): PullRequestRow[] {
  return db
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.issue_id, issueId), isNull(pullRequests.detached_at)))
    .orderBy(asc(pullRequests.created_at))
    .all();
}

/** The rows a background pass re-reads, so a merge is noticed without opening a pull request panel. */
export function listLivePullRequests(db: Db): PullRequestRow[] {
  return db
    .select()
    .from(pullRequests)
    .where(
      and(
        isNull(pullRequests.detached_at),
        isNotNull(pullRequests.number),
        inArray(pullRequests.status, LIVE_PULL_REQUEST_STATES),
      ),
    )
    .orderBy(asc(pullRequests.created_at))
    .all();
}

/** Publications a daemon was working through; after a restart every one of them is an interrupted operation. */
export function listActivePublications(db: Db): PullRequestRow[] {
  return db
    .select()
    .from(pullRequests)
    .where(
      and(
        isNotNull(pullRequests.run_id),
        isNull(pullRequests.detached_at),
        inArray(pullRequests.publication_status, PULL_REQUEST_PUBLICATION_ACTIVE_STATES),
      ),
    )
    .orderBy(asc(pullRequests.created_at))
    .all();
}

/** Both anchors count: a synced pull request carries no issue, and an early publication carries no repository. */
export function listPullRequestsForProject(db: Db, projectId: string): PullRequestRow[] {
  return db
    .select({ pullRequest: pullRequests })
    .from(pullRequests)
    .leftJoin(issues, eq(pullRequests.issue_id, issues.id))
    .leftJoin(repositories, eq(pullRequests.repository_id, repositories.id))
    .where(
      and(
        or(eq(issues.project_id, projectId), eq(repositories.project_id, projectId)),
        isNull(pullRequests.detached_at),
      ),
    )
    .orderBy(asc(pullRequests.created_at))
    .all()
    .map((row) => row.pullRequest);
}

export function listLivePullRequestsForRepository(db: Db, repositoryId: string): PullRequestRow[] {
  return db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repository_id, repositoryId),
        isNull(pullRequests.detached_at),
        inArray(pullRequests.status, LIVE_PULL_REQUEST_STATES),
      ),
    )
    .orderBy(asc(pullRequests.created_at))
    .all();
}

/** The live row mirroring one GitHub pull request, so a second attachment of the same number is refused rather than duplicated. */
export function findPullRequestByNumber(
  db: Db,
  repositoryId: string,
  number: number,
): PullRequestRow | undefined {
  return db
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repository_id, repositoryId),
        eq(pullRequests.number, number),
        isNull(pullRequests.detached_at),
      ),
    )
    .get();
}

export function updatePullRequest(db: Db, id: string, patch: PullRequestPatch): void {
  db.update(pullRequests).set(touch(patch)).where(eq(pullRequests.id, id)).run();
}
