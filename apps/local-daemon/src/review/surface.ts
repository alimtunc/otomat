import { randomUUID } from "node:crypto";

import {
  getReviewForSubject,
  insertReview,
  listReviewCommentsForSubject,
  listReviewedFilesForSubject,
  readGitHubViewer,
  type ReviewRow,
} from "@otomat/db";
import { reviewMachine } from "@otomat/domain";

import { reloadOrThrow } from "./reload.js";
import { ownedByViewer } from "./reviewed-files.js";
import type { ReviewContext, ReviewDetailResult, ReviewSubject } from "./types.js";

/** The subject's review row, created on the first thing that hangs from it: a comment or a reviewed mark. */
export function ensureReview(ctx: ReviewContext, subjectId: string): ReviewRow {
  const existing = getReviewForSubject(ctx.db, subjectId);
  if (existing) return existing;
  const id = randomUUID();
  insertReview(ctx.db, { id, subject_id: subjectId, status: reviewMachine.initial });
  return reloadOrThrow(
    () => getReviewForSubject(ctx.db, subjectId),
    `review ${id} vanished immediately after insert`,
  );
}

export function getReviewDetail(ctx: ReviewContext, subject: ReviewSubject): ReviewDetailResult {
  const connectedLogin = readGitHubViewer(ctx.db).login;
  return {
    review: getReviewForSubject(ctx.db, subject.id) ?? null,
    comments: listReviewCommentsForSubject(ctx.db, subject.id),
    reviewedFiles: listReviewedFilesForSubject(ctx.db, subject.id).filter((row) =>
      ownedByViewer(connectedLogin, row),
    ),
    fixAuthority: subject.fixAuthority(),
    destinations: subject.destinations(),
  };
}
