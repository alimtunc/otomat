import { getPullRequestForRun } from "@otomat/db";
import type { ReviewDestinationAvailability } from "@otomat/domain";

import type { ReviewContext } from "./types.js";

export function getDestinationAvailability(
  ctx: ReviewContext,
  runId: string,
): ReviewDestinationAvailability {
  const pullRequest = getPullRequestForRun(ctx.db, runId);
  if (pullRequest === undefined || pullRequest.number === null) {
    return {
      pr_review: false,
      reason: "This run has no pull request yet, so a comment can only go to the agent.",
    };
  }
  if (pullRequest.published_head_sha === null) {
    return {
      pr_review: false,
      reason: `Pull request #${pullRequest.number} has no published head commit to anchor a review comment on.`,
    };
  }
  return { pr_review: true, reason: `Pull request #${pullRequest.number} is open for review.` };
}
