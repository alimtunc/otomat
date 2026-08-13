import {
  commentAnchorLabel,
  commentFallbackReason,
} from "@web/components/runs/review/comment/anchor";
import { filterReviewComments } from "@web/components/runs/review/comment/filter";
import { describe, expect, it } from "vitest";

import { reviewComment } from "#support/review-comment";

const COMMENTS = [
  reviewComment({ id: "open" }),
  reviewComment({ id: "done", status: "addressed" }),
  reviewComment({ id: "moved", status: "outdated" }),
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
    expect(commentAnchorLabel(reviewComment({ line: 12 }))).toBe("src/a.ts:12 · head");
    expect(commentAnchorLabel(reviewComment({ start_line: 9, line: 12 }))).toBe(
      "src/a.ts:9-12 · head",
    );
    expect(commentAnchorLabel(reviewComment({ side: "old", line: 12 }))).toBe("src/a.ts:12 · base");
    expect(commentAnchorLabel(reviewComment({ line: null }))).toBe("src/a.ts · whole file");
  });

  it("states why a comment is shown away from its anchor", () => {
    expect(commentFallbackReason(reviewComment({ status: "addressed" }))).toContain("Addressed");
    expect(commentFallbackReason(reviewComment({ status: "outdated" }))).toContain("diff moved");
    expect(commentFallbackReason(reviewComment({ status: "open" }))).toContain("earlier version");
  });
});
