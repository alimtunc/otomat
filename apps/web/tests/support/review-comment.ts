import type { ReviewCommentContract } from "@otomat/domain";

export function reviewComment(
  overrides: Partial<ReviewCommentContract> = {},
): ReviewCommentContract {
  return {
    id: "c1",
    review_id: "rv1",
    file_path: "src/a.ts",
    side: "new",
    start_line: null,
    line: 3,
    diff_sha: "sha-a",
    body: "Fix this.",
    status: "open",
    destination: "agent",
    publication_status: "local",
    publication_error: null,
    external_url: null,
    suggestion: null,
    suggestion_original: null,
    hunk_snapshot: "@@ -1 +1 @@",
    fix_requested_at: null,
    ...overrides,
  };
}
