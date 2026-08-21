import { findDiffMatches, indexDiffLines } from "@web/components/runs/diff/search/matches";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";

const HEADER = `diff --git a/src/one.ts b/src/one.ts
index 0000001..0000002 100644
--- a/src/one.ts
+++ b/src/one.ts
`;

/** Old line 2 is removed, new line 2 added; both carry the needle, and line 3 carries it twice. */
const PATCH = `${HEADER}@@ -1,3 +1,3 @@
 const total = 1;
-const Answer = 2;
+const answer = 2;
 const answer = answer + total;
`;

const OTHER = `diff --git a/src/two.ts b/src/two.ts
index 0000003..0000004 100644
--- a/src/two.ts
+++ b/src/two.ts
@@ -10,2 +10,2 @@
-let answer;
+let resolved;
`;

const ONE = diffFile({ path: "src/one.ts", patch: PATCH });
const TWO = diffFile({ path: "src/two.ts", patch: OTHER });
const FILES = [ONE, TWO];

function matchesFor(query: string, order = FILES) {
  return findDiffMatches(order, indexDiffLines(FILES), query);
}

describe("finding matches in the loaded hunks", () => {
  it("finds every occurrence, case-insensitively, on both sides of a hunk", () => {
    expect(matchesFor("answer")).toEqual([
      { path: "src/one.ts", oldLine: 2, newLine: null, occurrence: 0 },
      { path: "src/one.ts", oldLine: null, newLine: 2, occurrence: 0 },
      { path: "src/one.ts", oldLine: 3, newLine: 3, occurrence: 0 },
      { path: "src/one.ts", oldLine: 3, newLine: 3, occurrence: 1 },
      { path: "src/two.ts", oldLine: 10, newLine: null, occurrence: 0 },
    ]);
  });

  it("counts the removed and the added form of one changed line separately", () => {
    expect(matchesFor("const answer")).toEqual([
      { path: "src/one.ts", oldLine: 2, newLine: null, occurrence: 0 },
      { path: "src/one.ts", oldLine: null, newLine: 2, occurrence: 0 },
      { path: "src/one.ts", oldLine: 3, newLine: 3, occurrence: 0 },
    ]);
  });

  it("walks the files in the order the reviewer displays them", () => {
    expect(matchesFor("answer", [TWO, ONE]).map((match) => match.path)).toEqual([
      "src/two.ts",
      "src/one.ts",
      "src/one.ts",
      "src/one.ts",
      "src/one.ts",
    ]);
  });

  it("treats the query literally, with no regex meaning", () => {
    expect(matchesFor("answer.")).toEqual([]);
    expect(matchesFor("answer + total")).toHaveLength(1);
  });

  it("matches nothing on an empty query or an absent needle", () => {
    expect(matchesFor("")).toEqual([]);
    expect(matchesFor("nowhere")).toEqual([]);
  });

  it("reads the hunk text only, never the diff or index headers", () => {
    expect(matchesFor("diff --git")).toEqual([]);
    expect(matchesFor("0000001")).toEqual([]);
  });

  it("counts across a carriage return @git-diff-view drops before rendering", () => {
    const carriage = diffFile({
      path: "src/crlf.ts",
      patch: `${HEADER}@@ -1 +1 @@\n-let a = 1;\n+a\rbab\n`,
    });

    expect(findDiffMatches([carriage], indexDiffLines([carriage]), "ab")).toEqual([
      { path: "src/crlf.ts", oldLine: null, newLine: 1, occurrence: 0 },
      { path: "src/crlf.ts", oldLine: null, newLine: 1, occurrence: 1 },
    ]);
  });

  it("indexes a file with no hunk without failing", () => {
    const empty = diffFile({ path: "logo.png", binary: true });
    expect(findDiffMatches([empty], indexDiffLines([empty]), "answer")).toEqual([]);
  });
});
