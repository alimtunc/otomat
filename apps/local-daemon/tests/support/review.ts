import type { ReviewCommentRow, ReviewRow } from "@otomat/db";

import type { ReviewService } from "#review";

export function reviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: "rv1",
    run_id: "run-detail",
    status: "in_review",
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export function commentRow(overrides: Partial<ReviewCommentRow> = {}): ReviewCommentRow {
  return {
    id: "c1",
    review_id: "rv1",
    file_path: "src/thing.ts",
    side: "new",
    start_line: null,
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
    status: "open",
    destination: "agent",
    publication_status: "local",
    publication_error: null,
    external_url: null,
    suggestion: null,
    suggestion_original: null,
    hunk_snapshot: "@@ -1 +1 @@",
    fix_requested_at: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

/** Every method throws or returns empty unless a test overrides it — no accidental fake success. */
export function stubReviewService(overrides: Partial<ReviewService> = {}): ReviewService {
  return {
    getWorktreeDiff: () => ({ computedAt: "2026-07-05T00:00:00.000Z", diff: null }),
    getReviewDetail: () => ({
      review: null,
      comments: [],
      fixAuthority: { kind: "otomat", reason: "Otomat owns this branch." },
      destinations: { pr_review: false, reason: "This run has no pull request yet." },
    }),
    addComment: async () => {
      throw new Error("addComment stub not configured");
    },
    publishComment: async () => {
      throw new Error("publishComment stub not configured");
    },
    getFileBlobs: () => {
      throw new Error("getFileBlobs stub not configured");
    },
    requestFix: async () => {
      throw new Error("requestFix stub not configured");
    },
    onRunSettled: () => {},
    ...overrides,
  };
}
