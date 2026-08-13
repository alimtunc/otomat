import type { RunDiffContract } from "@otomat/domain";
import { partitionComments } from "@web/components/runs/review/partition";
import { expect, it } from "vitest";

import { reviewComment } from "#support/review-comment";

const DIFF: RunDiffContract = {
  base: "base-sha",
  additions: 2,
  deletions: 0,
  sha: "diff-sha",
  files: [
    {
      path: "src/a.ts",
      old_path: null,
      status: "modified",
      additions: 2,
      deletions: 0,
      binary: false,
      patch: "@@ -1 +1,2 @@",
      sha: "sha-a",
    },
  ],
};

it("anchors an open comment whose (file, diff_sha) matches the live diff", () => {
  const { byLine, detached, anchoredIds } = partitionComments(DIFF, [reviewComment({ id: "c1" })]);
  expect(
    byLine
      .get("src/a.ts")
      ?.get(3)
      ?.map((c) => c.id),
  ).toEqual(["c1"]);
  expect(detached).toEqual([]);
  expect(anchoredIds.has("c1")).toBe(true);
});

it("groups multiple comments on the same line in creation order", () => {
  const { byLine } = partitionComments(DIFF, [
    reviewComment({ id: "c1" }),
    reviewComment({ id: "c2" }),
  ]);
  expect(
    byLine
      .get("src/a.ts")
      ?.get(3)
      ?.map((c) => c.id),
  ).toEqual(["c1", "c2"]);
});

it("keeps a whole-file comment out of the line map and against its file", () => {
  const { byFile, byLine } = partitionComments(DIFF, [reviewComment({ id: "whole", line: null })]);
  expect(byFile.get("src/a.ts")?.map((c) => c.id)).toEqual(["whole"]);
  expect(byLine.size).toBe(0);
});

it("detaches comments whose anchor left the diff — never migrates them", () => {
  const stale = reviewComment({ id: "stale", diff_sha: "sha-old" });
  const otherFile = reviewComment({ id: "other", file_path: "src/gone.ts" });
  const { byLine, detached, anchoredIds } = partitionComments(DIFF, [stale, otherFile]);
  expect(byLine.size).toBe(0);
  expect(detached.map((c) => c.id)).toEqual(["stale", "other"]);
  expect(anchoredIds.size).toBe(0);
});

it("detaches addressed and outdated comments even when their sha still matches", () => {
  const addressed = reviewComment({ id: "done", status: "addressed" });
  const outdated = reviewComment({ id: "old", status: "outdated" });
  const { byLine, detached } = partitionComments(DIFF, [addressed, outdated]);
  expect(byLine.size).toBe(0);
  expect(detached.map((c) => c.id)).toEqual(["done", "old"]);
});

it("names the files an unresolved comment protects from Hide reviewed", () => {
  const { commentedPaths } = partitionComments(DIFF, [
    reviewComment({ id: "line" }),
    reviewComment({ id: "whole", line: null }),
    reviewComment({ id: "stale", file_path: "src/gone.ts" }),
  ]);
  expect([...commentedPaths]).toEqual(["src/a.ts"]);
});

it("detaches everything when the run has no diff", () => {
  const { byLine, detached } = partitionComments(null, [reviewComment({})]);
  expect(byLine.size).toBe(0);
  expect(detached).toHaveLength(1);
});

it("counts every comment of a file still in the diff, stale ones included", () => {
  const { countsByPath } = partitionComments(DIFF, [
    reviewComment({ id: "open" }),
    reviewComment({ id: "stale", diff_sha: "sha-old" }),
    reviewComment({ id: "done", status: "addressed" }),
    reviewComment({ id: "on-pr", destination: "pr_review" }),
    reviewComment({ id: "elsewhere", file_path: "src/gone.ts" }),
  ]);

  expect(countsByPath.get("src/a.ts")).toEqual({
    open: 3,
    addressed: 1,
    agent: 3,
    prReview: 1,
    stale: 1,
  });
  expect(countsByPath.has("src/gone.ts")).toBe(false);
});
