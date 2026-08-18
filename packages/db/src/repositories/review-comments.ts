import type { ReviewCommentPublicationState, ReviewCommentState } from "@otomat/domain";
import { eq, getTableColumns } from "drizzle-orm";

import type { Db } from "../client.js";
import { reviewComments, reviews } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewReviewComment = typeof reviewComments.$inferInsert;
export type ReviewCommentRow = typeof reviewComments.$inferSelect;

export function insertReviewComment(db: Db, value: NewReviewComment): void {
  db.insert(reviewComments).values(value).run();
}

export function getReviewComment(db: Db, id: string): ReviewCommentRow | undefined {
  return db.select().from(reviewComments).where(eq(reviewComments.id, id)).get();
}

export function listReviewCommentsForSubject(db: Db, subjectId: string): ReviewCommentRow[] {
  return db
    .select(getTableColumns(reviewComments))
    .from(reviewComments)
    .innerJoin(reviews, eq(reviewComments.review_id, reviews.id))
    .where(eq(reviews.subject_id, subjectId))
    .orderBy(reviewComments.created_at)
    .all();
}

function patchReviewComment(
  db: Db,
  id: string,
  set: Partial<typeof reviewComments.$inferInsert>,
): void {
  db.update(reviewComments).set(touch(set)).where(eq(reviewComments.id, id)).run();
}

export function updateReviewCommentStatus(db: Db, id: string, status: ReviewCommentState): void {
  patchReviewComment(db, id, { status });
}

export function setReviewCommentFixRequested(db: Db, id: string, at: string | null): void {
  patchReviewComment(db, id, { fix_requested_at: at });
}

export interface ReviewCommentPublicationPatch {
  publication_status: ReviewCommentPublicationState;
  publication_error?: string | null;
  external_url?: string | null;
}

export function setReviewCommentPublication(
  db: Db,
  id: string,
  patch: ReviewCommentPublicationPatch,
): void {
  patchReviewComment(db, id, patch);
}
