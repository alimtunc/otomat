import type { ReviewedFileContract } from "@otomat/domain";
import { reviewedPaths, unsyncedMarks } from "@web/components/runs/diff/reviewed-files";
import { describe, expect, it } from "vitest";

const FILES = [
  { path: "a.ts", sha: "sha-a" },
  { path: "b.ts", sha: "sha-b" },
];

function mark(overrides: Partial<ReviewedFileContract>): ReviewedFileContract {
  return {
    id: "rf1",
    review_id: "rv1",
    file_path: "a.ts",
    diff_sha: "sha-a",
    reviewed: true,
    sync_status: "local",
    sync_error: null,
    ...overrides,
  };
}

describe("reviewed marks over a diff", () => {
  it("counts a file reviewed only while it still reads at the sha it was marked against", () => {
    const marks = [mark({}), mark({ id: "rf2", file_path: "b.ts", diff_sha: "sha-b" })];
    expect(reviewedPaths(marks, FILES, new Map())).toEqual(new Set(["a.ts", "b.ts"]));
    expect(reviewedPaths(marks, [{ path: "a.ts", sha: "sha-a-2" }, FILES[1]!], new Map())).toEqual(
      new Set(["b.ts"]),
    );
  });

  it("leaves an unmarked file out even when its mark is current", () => {
    expect(reviewedPaths([mark({ reviewed: false })], FILES, new Map())).toEqual(new Set());
  });

  it("follows every unsettled toggle at once, so a second click cannot revert the first", () => {
    expect(reviewedPaths([mark({})], FILES, new Map([["a.ts", false]]))).toEqual(new Set());
    expect(
      reviewedPaths(
        [mark({})],
        FILES,
        new Map([
          ["a.ts", false],
          ["b.ts", true],
        ]),
      ),
    ).toEqual(new Set(["b.ts"]));
    expect(reviewedPaths([], FILES, new Map([["gone.ts", true]]))).toEqual(new Set());
  });

  it("offers a retry for a mark GitHub refused or has not taken, and for nothing else", () => {
    const marks = [
      mark({ id: "rf1", file_path: "a.ts", sync_status: "failed", sync_error: "GitHub said no." }),
      mark({ id: "rf2", file_path: "b.ts", sync_status: "pending" }),
      mark({ id: "rf3", file_path: "c.ts", sync_status: "synced" }),
      mark({ id: "rf4", file_path: "d.ts", sync_status: "local" }),
    ];
    expect([...unsyncedMarks(marks).keys()]).toEqual(["a.ts", "b.ts"]);
    expect(unsyncedMarks(marks).get("a.ts")?.sync_error).toBe("GitHub said no.");
  });
});
