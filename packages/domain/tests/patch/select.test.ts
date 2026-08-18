import { narrowPatchToRange } from "@otomat/domain";
import { describe, expect, it } from "vitest";

const PATCH = [
  "diff --git a/src/thing.ts b/src/thing.ts",
  "--- a/src/thing.ts",
  "+++ b/src/thing.ts",
  "@@ -1,3 +1,3 @@",
  " alpha",
  "-beta",
  "+BETA",
  " gamma",
  "@@ -40,3 +40,4 @@",
  " forty",
  "+forty-one",
  " forty-two",
  " forty-three",
].join("\n");

describe("narrowPatchToRange", () => {
  it("keeps only the hunk covering the range, with the file header it belongs to", () => {
    const narrowed = narrowPatchToRange(PATCH, { side: "old", startLine: 2, endLine: 2 });

    expect(narrowed).toContain("diff --git a/src/thing.ts b/src/thing.ts");
    expect(narrowed).toContain("+++ b/src/thing.ts");
    expect(narrowed).toContain("@@ -1,3 +1,3 @@");
    expect(narrowed).not.toContain("@@ -40,3 +40,4 @@");
  });

  it("keeps every hunk a multi-line range spans", () => {
    const narrowed = narrowPatchToRange(PATCH, { side: "old", startLine: 2, endLine: 41 });

    expect(narrowed).toContain("@@ -1,3 +1,3 @@");
    expect(narrowed).toContain("@@ -40,3 +40,4 @@");
  });

  it("reads a range on the new side against the new line numbers", () => {
    const narrowed = narrowPatchToRange(PATCH, { side: "new", startLine: 41, endLine: 41 });

    expect(narrowed).toContain("@@ -40,3 +40,4 @@");
    expect(narrowed).not.toContain("@@ -1,3 +1,3 @@");
  });

  it("returns null rather than the whole patch when no hunk touches the range", () => {
    expect(narrowPatchToRange(PATCH, { side: "old", startLine: 20, endLine: 25 })).toBeNull();
  });

  it("returns null on a patch with no hunk at all", () => {
    expect(narrowPatchToRange("", { side: "old", startLine: 1, endLine: 1 })).toBeNull();
  });
});
