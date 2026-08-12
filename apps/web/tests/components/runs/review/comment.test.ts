import type { ReviewCommentContract } from "@otomat/domain";
import {
  commentAnchorLabel,
  commentFallbackReason,
} from "@web/components/runs/review/comment/anchor";
import { filterReviewComments } from "@web/components/runs/review/comment/filter";
import { describe, expect, it } from "vitest";

function comment(overrides: Partial<ReviewCommentContract>): ReviewCommentContract {
  return {
    id: "c1",
    review_id: "rv1",
    file_path: "src/a.ts",
    line: 3,
    diff_sha: "sha-a",
    body: "Fix this.",
    status: "open",
    hunk_snapshot: "",
    fix_requested_at: null,
    ...overrides,
  };
}

const COMMENTS = [
  comment({ id: "open" }),
  comment({ id: "done", status: "addressed" }),
  comment({ id: "moved", status: "outdated" }),
];

describe("comment state filter", () => {
  it("keeps every comment under All", () => {
    expect(filterReviewComments(COMMENTS, "all").map((c) => c.id)).toEqual([
      "open",
      "done",
      "moved",
    ]);
  });

  it("keeps only the comments in the selected state", () => {
    expect(filterReviewComments(COMMENTS, "open").map((c) => c.id)).toEqual(["open"]);
    expect(filterReviewComments(COMMENTS, "addressed").map((c) => c.id)).toEqual(["done"]);
    expect(filterReviewComments(COMMENTS, "outdated").map((c) => c.id)).toEqual(["moved"]);
  });
});

describe("comment anchors", () => {
  it("names a line anchor and a whole-file anchor differently", () => {
    expect(commentAnchorLabel(comment({ line: 12 }))).toBe("src/a.ts:12");
    expect(commentAnchorLabel(comment({ line: null }))).toBe("src/a.ts · whole file");
  });

  it("states why a comment is shown away from its anchor", () => {
    expect(commentFallbackReason(comment({ status: "addressed" }))).toContain("Addressed");
    expect(commentFallbackReason(comment({ status: "outdated" }))).toContain("diff moved");
    expect(commentFallbackReason(comment({ status: "open" }))).toContain("earlier version");
  });
});
