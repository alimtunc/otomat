import type { ReviewDetail, ReviewedFileContract } from "@otomat/domain";

export function reviewDetail(
  reviewedFiles: ReviewedFileContract[] = [],
  overrides: Partial<ReviewDetail> = {},
): ReviewDetail {
  return {
    review: null,
    comments: [],
    reviewed_files: reviewedFiles,
    fix_authority: { kind: "external", reason: "This pull request is someone else's branch." },
    destinations: { pr_review: false, reason: "This run has no pull request yet." },
    ...overrides,
  };
}
