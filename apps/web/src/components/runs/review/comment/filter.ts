import { REVIEW_COMMENT_STATES, type ReviewCommentContract } from "@otomat/domain";

export const REVIEW_COMMENT_FILTERS = ["all", ...REVIEW_COMMENT_STATES] as const;
export type ReviewCommentFilter = (typeof REVIEW_COMMENT_FILTERS)[number];

export function isReviewCommentFilter(value: string): value is ReviewCommentFilter {
  return REVIEW_COMMENT_FILTERS.some((option) => option === value);
}

export function filterReviewComments(
  comments: readonly ReviewCommentContract[],
  filter: ReviewCommentFilter,
): ReviewCommentContract[] {
  if (filter === "all") return [...comments];
  return comments.filter((comment) => comment.status === filter);
}
