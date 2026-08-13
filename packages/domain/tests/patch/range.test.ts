import { expect, it } from "vitest";

import {
  hunkCoveringRange,
  readRangeLines,
  reviewRangeRefusal,
  suggestionRefusal,
} from "#domain/patch/range";

const PATCH = [
  "diff --git a/notes.md b/notes.md",
  "index 1111111..2222222 100644",
  "--- a/notes.md",
  "+++ b/notes.md",
  "@@ -1,3 +1,4 @@",
  " alpha",
  "-beta",
  "+bravo",
  "+charlie",
  " gamma",
  "@@ -10,2 +11,2 @@",
  "-omega",
  "+omicron",
  " end",
  "",
].join("\n");

it("reads the head lines a range covers, markers stripped", () => {
  expect(readRangeLines(PATCH, { side: "new", startLine: 2, endLine: 4 })).toEqual([
    "bravo",
    "charlie",
    "gamma",
  ]);
});

it("reads the base side by its own numbering", () => {
  expect(readRangeLines(PATCH, { side: "old", startLine: 1, endLine: 2 })).toEqual([
    "alpha",
    "beta",
  ]);
});

it("finds the single hunk covering a range and none across two", () => {
  expect(hunkCoveringRange(PATCH, { side: "new", startLine: 1, endLine: 4 })?.newStart).toBe(1);
  expect(hunkCoveringRange(PATCH, { side: "new", startLine: 4, endLine: 11 })).toBeNull();
});

it("explains a range GitHub would refuse instead of shortening it", () => {
  expect(reviewRangeRefusal(PATCH, { side: "new", startLine: 1, endLine: 4 })).toBeNull();
  expect(reviewRangeRefusal(PATCH, { side: "new", startLine: 4, endLine: 1 })).toContain(
    "ends before it starts",
  );
  expect(reviewRangeRefusal(PATCH, { side: "new", startLine: 4, endLine: 11 })).toContain(
    "single hunk",
  );
});

it("keeps a suggestion to the head side of a coverable range", () => {
  expect(suggestionRefusal(PATCH, { side: "new", startLine: 2, endLine: 3 })).toBeNull();
  expect(suggestionRefusal(PATCH, { side: "old", startLine: 1, endLine: 2 })).toContain(
    "new side of the diff",
  );
  expect(suggestionRefusal(PATCH, { side: "new", startLine: 4, endLine: 40 })).toContain(
    "not all inside one hunk",
  );
});

it("ignores lines past a hunk's declared counts", () => {
  const truncated = ["@@ -1,1 +1,1 @@", " only", "", "trailing junk"].join("\n");
  expect(hunkCoveringRange(truncated, { side: "new", startLine: 2, endLine: 2 })).toBeNull();
  expect(readRangeLines(truncated, { side: "new", startLine: 1, endLine: 1 })).toEqual(["only"]);
});
