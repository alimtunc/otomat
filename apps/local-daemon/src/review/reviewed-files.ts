import { randomUUID } from "node:crypto";

import {
  findReviewedFile,
  getReviewedFile,
  insertReviewedFile,
  setReviewedFileMark,
  setReviewedFileSync,
  type ReviewedFileMarkPatch,
  type ReviewedFileRow,
} from "@otomat/db";
import { drivePath, reviewedFileSyncMachine, type ReviewedFileSyncState } from "@otomat/domain";

import { reloadOrThrow } from "./reload.js";
import type { ReviewContext } from "./types.js";

export interface ReviewedMark {
  filePath: string;
  diffSha: string;
  reviewed: boolean;
  /** Absent leaves whatever account the row already carries; `null` clears it. */
  viewerLogin?: string | null;
}

function reload(ctx: ReviewContext, id: string): ReviewedFileRow {
  return reloadOrThrow(
    () => getReviewedFile(ctx.db, id),
    `reviewed file ${id} vanished immediately after write`,
  );
}

/** Not knowing which account is connected is no evidence of another user, so only a known-different one hides a mark. */
export function ownedByViewer(connectedLogin: string | null, row: ReviewedFileRow): boolean {
  return (
    row.viewer_login === null || connectedLogin === null || connectedLogin === row.viewer_login
  );
}

export function upsertReviewedMark(
  ctx: ReviewContext,
  reviewId: string,
  mark: ReviewedMark,
): ReviewedFileRow {
  const existing = findReviewedFile(ctx.db, reviewId, mark.filePath);
  if (existing) {
    const patch: ReviewedFileMarkPatch = { diff_sha: mark.diffSha, reviewed: mark.reviewed };
    if (mark.viewerLogin !== undefined) patch.viewer_login = mark.viewerLogin;
    setReviewedFileMark(ctx.db, existing.id, patch);
    return reload(ctx, existing.id);
  }
  const id = randomUUID();
  insertReviewedFile(ctx.db, {
    id,
    review_id: reviewId,
    file_path: mark.filePath,
    diff_sha: mark.diffSha,
    reviewed: mark.reviewed,
    sync_status: reviewedFileSyncMachine.initial,
    viewer_login: mark.viewerLogin ?? null,
  });
  return reload(ctx, id);
}

/** Re-asserting the mark's current state writes nothing, `patch` included. */
export function driveReviewedFileSync(
  ctx: ReviewContext,
  row: ReviewedFileRow,
  to: ReviewedFileSyncState,
  patch: { sync_error?: string | null; viewer_login?: string | null } = {},
): ReviewedFileRow {
  drivePath(reviewedFileSyncMachine, row.sync_status, to, (state) =>
    setReviewedFileSync(ctx.db, row.id, { sync_status: state, ...patch }),
  );
  return reload(ctx, row.id);
}
