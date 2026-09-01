import type { DiffFileContract, ReviewDiffContract } from "@otomat/domain";

/** Carries a keyword, so a card that is highlighted is distinguishable from one that is not. */
export function diffPatch(path: string): string {
  return `diff --git a/${path} b/${path}
index 0000001..0000002 100644
--- a/${path}
+++ b/${path}
@@ -1,2 +1,2 @@
 first line
-second line
+const answer = 42;
`;
}

export function diffFile(
  overrides: Partial<DiffFileContract> & { path: string },
): DiffFileContract {
  return {
    old_path: null,
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: "",
    sha: `sha-${overrides.path}`,
    ...overrides,
  };
}

export function reviewDiff(overrides: Partial<ReviewDiffContract> = {}): ReviewDiffContract {
  return {
    base: "base-sha",
    head: "head-sha",
    files: [],
    additions: 0,
    deletions: 0,
    sha: "diff-sha",
    ...overrides,
  };
}
