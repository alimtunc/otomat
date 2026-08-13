import type { DiffSide, ReviewCommentContract } from "@otomat/domain";

type Anchor = Pick<ReviewCommentContract, "file_path" | "side" | "start_line" | "line">;

export function sideLabel(side: DiffSide): string {
  return side === "old" ? "base" : "head";
}

export function commentAnchorLabel(comment: Anchor): string {
  if (comment.line === null) return `${comment.file_path} · whole file`;
  const lines =
    comment.start_line === null ? comment.line : `${comment.start_line}-${comment.line}`;
  return `${comment.file_path}:${lines} · ${sideLabel(comment.side)}`;
}

export function reviewCommentDomId(commentId: string): string {
  return `review-comment-${commentId}`;
}

export function commentFallbackReason(comment: ReviewCommentContract): string {
  if (comment.status === "addressed") return "Addressed by a fix step.";
  if (comment.status === "outdated") return "The diff moved under this anchor.";
  return "Pinned to an earlier version of this file.";
}
