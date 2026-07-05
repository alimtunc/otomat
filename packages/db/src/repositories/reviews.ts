import type { ReviewState } from "@otomat/domain";
import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { reviews } from "../schema/index.js";

export type NewReview = typeof reviews.$inferInsert;
export type ReviewRow = typeof reviews.$inferSelect;

export function insertReview(db: Db, value: NewReview): void {
  db.insert(reviews).values(value).run();
}

export function getReview(db: Db, id: string): ReviewRow | undefined {
  return db.select().from(reviews).where(eq(reviews.id, id)).get();
}

/** A run has at most one review surface; the latest row wins if legacy data ever holds more. */
export function getReviewForRun(db: Db, runId: string): ReviewRow | undefined {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.run_id, runId))
    .orderBy(desc(reviews.created_at))
    .get();
}

export function updateReviewStatus(db: Db, id: string, status: ReviewState): void {
  db.update(reviews)
    .set({ status, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(reviews.id, id))
    .run();
}
