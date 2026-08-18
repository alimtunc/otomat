import { and, asc, eq, isNull } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, pullRequests } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewPullRequest = typeof pullRequests.$inferInsert;
export type PullRequestRow = typeof pullRequests.$inferSelect;
export type PullRequestPatch = Partial<
  Pick<
    PullRequestRow,
    | "provider"
    | "origin"
    | "provenance"
    | "author_login"
    | "repository_id"
    | "number"
    | "url"
    | "status"
    | "publication_status"
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

export function listPullRequestsForProject(db: Db, projectId: string): PullRequestRow[] {
  return db
    .select({ pullRequest: pullRequests })
    .from(pullRequests)
    .innerJoin(issues, eq(pullRequests.issue_id, issues.id))
    .where(and(eq(issues.project_id, projectId), isNull(pullRequests.detached_at)))
    .orderBy(asc(pullRequests.created_at))
    .all()
    .map((row) => row.pullRequest);
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
