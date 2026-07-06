import type { ReviewCommentContract, RunDiffContract } from "@otomat/domain";
import { partitionComments } from "@web/components/runs/review/partition";
import { expect, it } from "vitest";

function comment(overrides: Partial<ReviewCommentContract>): ReviewCommentContract {
  return {
    id: "c1",
    review_id: "rv1",
    file_path: "src/a.ts",
    line: 3,
    diff_sha: "sha-a",
    body: "Fix this.",
    status: "open",
    hunk_snapshot: "@@ -1 +1 @@",
    fix_requested_at: null,
    ...overrides,
  };
}

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
  const anchored = comment({ id: "c1" });
  const { anchored: byFile, archived } = partitionComments(DIFF, [anchored]);
  expect(
    byFile
      .get("src/a.ts")
      ?.get(3)
      ?.map((c) => c.id),
  ).toEqual(["c1"]);
  expect(archived).toEqual([]);
});

it("groups multiple comments on the same line in creation order", () => {
  const first = comment({ id: "c1" });
  const second = comment({ id: "c2" });
  const { anchored } = partitionComments(DIFF, [first, second]);
  expect(
    anchored
      .get("src/a.ts")
      ?.get(3)
      ?.map((c) => c.id),
  ).toEqual(["c1", "c2"]);
});

it("archives comments whose anchor left the diff — never migrates them", () => {
  const stale = comment({ id: "stale", diff_sha: "sha-old" });
  const otherFile = comment({ id: "other", file_path: "src/gone.ts" });
  const { anchored, archived } = partitionComments(DIFF, [stale, otherFile]);
  expect(anchored.size).toBe(0);
  expect(archived.map((c) => c.id)).toEqual(["stale", "other"]);
});

it("archives addressed and outdated comments even when their sha still matches", () => {
  const addressed = comment({ id: "done", status: "addressed" });
  const outdated = comment({ id: "old", status: "outdated" });
  const { anchored, archived } = partitionComments(DIFF, [addressed, outdated]);
  expect(anchored.size).toBe(0);
  expect(archived.map((c) => c.id)).toEqual(["done", "old"]);
});

it("archives everything when the run has no diff", () => {
  const { anchored, archived } = partitionComments(null, [comment({})]);
  expect(anchored.size).toBe(0);
  expect(archived).toHaveLength(1);
});
