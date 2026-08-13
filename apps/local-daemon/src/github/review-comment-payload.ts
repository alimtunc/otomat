import type { ReviewCommentCreateInput } from "./types.js";

/** Request body of `POST /repos/{repo}/pulls/{number}/comments`; a single-line anchor omits the start fields. */
export function reviewCommentPayload(input: ReviewCommentCreateInput): Record<string, unknown> {
  return {
    body: input.body,
    commit_id: input.commitSha,
    path: input.path,
    side: input.side,
    line: input.line,
    ...(input.startLine === undefined
      ? {}
      : { start_line: input.startLine, start_side: input.startSide }),
  };
}
