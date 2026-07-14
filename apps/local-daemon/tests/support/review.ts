import type { PullRequestRow, ReviewCommentRow, ReviewRow } from "@otomat/db";

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
    line: 12,
    diff_sha: "sha-1",
    body: "Rename this.",
    status: "open",
    hunk_snapshot: "@@ -1 +1 @@",
    fix_requested_at: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export function pullRequestRow(overrides: Partial<PullRequestRow> = {}): PullRequestRow {
  return {
    id: "pr1",
    run_id: "run-detail",
    provider: "github",
    number: null,
    url: null,
    status: "draft",
    publication_status: "not_configured",
    title: "First slice",
    body: null,
    head_ref: null,
    base_ref: null,
    published_head_sha: null,
    published_diff_sha: null,
    error_code: null,
    error_message: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

/** Every method throws or returns empty unless a test overrides it — no accidental fake success. */
export function stubReviewService(overrides: Partial<ReviewService> = {}): ReviewService {
  return {
    getRunDiff: () => ({ computedAt: "2026-07-05T00:00:00.000Z", diff: null }),
    getReviewDetail: () => ({ review: null, comments: [] }),
    addComment: () => {
      throw new Error("addComment stub not configured");
    },
    prepareFix: () => {
      throw new Error("prepareFix stub not configured");
    },
    markFixRequested: () => {},
    onRunSettled: () => {},
    ...overrides,
  };
}
