import type { ReviewCommentCreateInput, ReviewCommentSide } from "./types.js";

/** Request body of `POST /repos/{repo}/pulls/{number}/comments`; a single-line anchor omits the start fields. */
interface ReviewCommentPayload {
  body: string;
  commit_id: string;
  path: string;
  side: ReviewCommentSide;
  line: number;
  start_line?: number;
  start_side?: ReviewCommentSide;
}

export function reviewCommentPayload(input: ReviewCommentCreateInput): ReviewCommentPayload {
  const payload: ReviewCommentPayload = {
    body: input.body,
    commit_id: input.commitSha,
    path: input.path,
    side: input.side,
    line: input.line,
  };
  if (input.startLine !== undefined) {
    payload.start_line = input.startLine;
    payload.start_side = input.startSide;
  }
  return payload;
}
