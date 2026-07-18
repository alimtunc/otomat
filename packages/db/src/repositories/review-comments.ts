import type { ReviewCommentState } from "@otomat/domain";
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

export function listReviewCommentsForRun(db: Db, runId: string): ReviewCommentRow[] {
  return db
    .select(getTableColumns(reviewComments))
    .from(reviewComments)
    .innerJoin(reviews, eq(reviewComments.review_id, reviews.id))
    .where(eq(reviews.run_id, runId))
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
