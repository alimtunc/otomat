import { hideReviewedFiles, sortDiffFiles } from "@web/components/runs/diff/visible-files";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";

const FILES = [
  diffFile({ path: "src/z.ts", additions: 25, deletions: 5 }),
  diffFile({ path: "src/a.ts", additions: 1, deletions: 0 }),
  diffFile({ path: "src/m.ts", additions: 3, deletions: 0 }),
];

const NONE: ReadonlySet<string> = new Set();

describe("reading order", () => {
  it("orders by path", () => {
    expect(sortDiffFiles(FILES, "path").map((file) => file.path)).toEqual([
      "src/a.ts",
      "src/m.ts",
      "src/z.ts",
    ]);
  });

  it("orders by change volume, largest first", () => {
    expect(sortDiffFiles(FILES, "changes").map((file) => file.path)).toEqual([
      "src/z.ts",
      "src/m.ts",
      "src/a.ts",
    ]);
  });

  it("leaves the source list untouched", () => {
    sortDiffFiles(FILES, "path");
    expect(FILES.map((file) => file.path)).toEqual(["src/z.ts", "src/a.ts", "src/m.ts"]);
  });
});

describe("hide reviewed", () => {
  it("withholds reviewed files and says how many", () => {
    const result = hideReviewedFiles(FILES, {
      hideReviewed: true,
      reviewedPaths: new Set(["src/a.ts", "src/z.ts"]),
      commentedPaths: NONE,
    });

    expect(result.files.map((file) => file.path)).toEqual(["src/m.ts"]);
    expect(result.hiddenCount).toBe(2);
  });

  it("never hides a reviewed file that still carries an unresolved comment", () => {
    const result = hideReviewedFiles(FILES, {
      hideReviewed: true,
      reviewedPaths: new Set(["src/a.ts", "src/z.ts"]),
      commentedPaths: new Set(["src/z.ts"]),
    });

    expect(result.files.map((file) => file.path)).toEqual(["src/z.ts", "src/m.ts"]);
    expect(result.hiddenCount).toBe(1);
  });

  it("hides nothing while the preference is off", () => {
    const result = hideReviewedFiles(FILES, {
      hideReviewed: false,
      reviewedPaths: new Set(["src/a.ts"]),
      commentedPaths: NONE,
    });

    expect(result.files).toHaveLength(3);
    expect(result.hiddenCount).toBe(0);
  });
});
