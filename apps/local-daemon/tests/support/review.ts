import type { ReviewCommentRow, ReviewedFileRow, ReviewRow } from "@otomat/db";
import type { RunDiffScope } from "@otomat/domain";

import type { ReviewService } from "#review";

export const BRANCH_SCOPE: RunDiffScope = {
  kind: "branch",
  branch: "otomat/run/x",
  base_ref: "main",
};

export function reviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: "rv1",
    subject_id: "run-detail",
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
    fixed_by_session_id: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

export function reviewedFileRow(overrides: Partial<ReviewedFileRow> = {}): ReviewedFileRow {
  return {
    id: "rf1",
    review_id: "rv1",
    file_path: "src/thing.ts",
    diff_sha: "sha-1",
    reviewed: true,
    sync_status: "local",
    sync_error: null,
    viewer_login: null,
    created_at: "2026-07-05T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

/** Every method throws or returns empty unless a test overrides it — no accidental fake success. */
export function stubReviewService(overrides: Partial<ReviewService> = {}): ReviewService {
  return {
    getDiff: () => ({
      computedAt: "2026-07-05T00:00:00.000Z",
      diff: null,
      scope: { kind: "branch", branch: null, base_ref: null },
      unavailable: "This run has no worktree, so there is no current diff to show.",
    }),
    getBranchCommits: () => ({ commits: [], unavailable: null }),
    getCommentFixProof: () => {
      throw new Error("getCommentFixProof stub not configured");
    },
    getReviewDetail: () => ({
      review: null,
      comments: [],
      reviewedFiles: [],
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
    setReviewedFile: async () => {
      throw new Error("setReviewedFile stub not configured");
    },
    importViewedFiles: async () => {
      throw new Error("importViewedFiles stub not configured");
    },
    requestFix: async () => {
      throw new Error("requestFix stub not configured");
    },
    onRunSettled: () => {},
    ...overrides,
  };
}
