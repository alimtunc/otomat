import type { ReviewCommentContract } from "@otomat/domain";

type Anchor = Pick<ReviewCommentContract, "file_path" | "line">;

export function commentAnchorLabel(comment: Anchor): string {
  if (comment.line === null) return `${comment.file_path} · whole file`;
  return `${comment.file_path}:${comment.line}`;
}

export function reviewCommentDomId(commentId: string): string {
  return `review-comment-${commentId}`;
}

export function commentFallbackReason(comment: ReviewCommentContract): string {
  if (comment.status === "addressed") return "Addressed by a fix step.";
  if (comment.status === "outdated") return "The diff moved under this anchor.";
  return "Pinned to an earlier version of this file.";
}
