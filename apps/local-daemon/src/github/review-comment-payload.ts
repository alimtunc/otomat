import type { DiffSide } from "@otomat/domain";

import type { PullRequestCommentInput } from "#review";

import { reviewCommentBody } from "./body.js";
import type { ReviewCommentSide, ReviewSubmissionComment } from "./cli/contract.js";
import { GitHubPublicationError } from "./errors.js";

function side(value: DiffSide): ReviewCommentSide {
  return value === "old" ? "LEFT" : "RIGHT";
}

/** One entry of a review's `comments` array; a single-line anchor omits the start fields. */
export function reviewCommentPayload(input: PullRequestCommentInput): ReviewSubmissionComment {
  if (input.line === null) {
    throw new GitHubPublicationError(
      "comment_line_missing",
      "GitHub anchors a review comment to lines, so a whole-file note cannot be submitted.",
    );
  }
  const payload: ReviewSubmissionComment = {
    path: input.filePath,
    body: reviewCommentBody(input.body, input.suggestion),
    side: side(input.side),
    line: input.line,
  };
  if (input.startLine !== null) {
    payload.start_line = input.startLine;
    payload.start_side = side(input.side);
  }
  return payload;
}
