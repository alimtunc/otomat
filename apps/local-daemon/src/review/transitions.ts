import { updateReviewStatus, type ReviewRow } from "@otomat/db";
import { drivePath, reviewMachine, type ReviewState } from "@otomat/domain";

import type { ReviewContext } from "./types.js";

/** Walks the review to `to` along the shortest legal path. */
export function driveReviewTo(ctx: ReviewContext, review: ReviewRow, to: ReviewState): void {
  drivePath(reviewMachine, review.status, to, (state) =>
    updateReviewStatus(ctx.db, review.id, state),
  );
}
