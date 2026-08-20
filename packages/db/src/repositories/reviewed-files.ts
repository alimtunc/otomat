import type { ReviewedFileSyncState } from "@otomat/domain";
import { and, eq, getTableColumns } from "drizzle-orm";

import type { Db } from "../client.js";
import { reviewedFiles, reviews } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewReviewedFile = typeof reviewedFiles.$inferInsert;
export type ReviewedFileRow = typeof reviewedFiles.$inferSelect;

export function insertReviewedFile(db: Db, value: NewReviewedFile): void {
  db.insert(reviewedFiles).values(value).run();
}

export function getReviewedFile(db: Db, id: string): ReviewedFileRow | undefined {
  return db.select().from(reviewedFiles).where(eq(reviewedFiles.id, id)).get();
}

export function findReviewedFile(
  db: Db,
  reviewId: string,
  filePath: string,
): ReviewedFileRow | undefined {
  return db
    .select()
    .from(reviewedFiles)
    .where(and(eq(reviewedFiles.review_id, reviewId), eq(reviewedFiles.file_path, filePath)))
    .get();
}

export function listReviewedFilesForSubject(db: Db, subjectId: string): ReviewedFileRow[] {
  return db
    .select(getTableColumns(reviewedFiles))
    .from(reviewedFiles)
    .innerJoin(reviews, eq(reviewedFiles.review_id, reviews.id))
    .where(eq(reviews.subject_id, subjectId))
    .orderBy(reviewedFiles.file_path)
    .all();
}

function patchReviewedFile(db: Db, id: string, set: Partial<NewReviewedFile>): void {
  db.update(reviewedFiles).set(touch(set)).where(eq(reviewedFiles.id, id)).run();
}

export interface ReviewedFileMarkPatch {
  diff_sha: string;
  reviewed: boolean;
  viewer_login?: string | null;
}

export function setReviewedFileMark(db: Db, id: string, patch: ReviewedFileMarkPatch): void {
  patchReviewedFile(db, id, patch);
}

export interface ReviewedFileSyncPatch {
  sync_status: ReviewedFileSyncState;
  sync_error?: string | null;
  viewer_login?: string | null;
}

export function setReviewedFileSync(db: Db, id: string, patch: ReviewedFileSyncPatch): void {
  patchReviewedFile(db, id, patch);
}
