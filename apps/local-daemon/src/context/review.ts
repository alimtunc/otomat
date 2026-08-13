import type { ReviewCommentRow } from "@otomat/db";
import { CONTEXT_REVIEW_FILE_MAX_LENGTH, type ContextReviewComment } from "@otomat/domain";

/** Freezes one selected comment with the anchor it was written against; `currentFile` comes from the same captured tree as the diff. */
export function reviewCommentContext(
  comment: ReviewCommentRow,
  currentFile: string | null,
): ContextReviewComment {
  return {
    id: comment.id,
    file_path: comment.file_path,
    line: comment.line,
    body: comment.body,
    diff_sha: comment.diff_sha,
    hunk: comment.hunk_snapshot,
    current_file:
      currentFile === null ? null : currentFile.slice(0, CONTEXT_REVIEW_FILE_MAX_LENGTH),
  };
}
