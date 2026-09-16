import type { WorktreeFileEntry } from "@otomat/domain";
import { searchFiles } from "@web/components/files/search";
import { expect, it } from "vitest";

it("finds fuzzy paths and ranks exact filenames ahead of path matches", () => {
  const entries: WorktreeFileEntry[] = [
    "src/app/tests.ts",
    "app.ts",
    "packages/domain/contracts.ts",
    "app.ts.backup",
  ].map((path) => ({ path, kind: "file", size: 1 }));
  expect(searchFiles(entries, "app.ts").map((entry) => entry.path)).toEqual([
    "app.ts",
    "app.ts.backup",
    "src/app/tests.ts",
  ]);
  expect(searchFiles(entries, "pkgdomcon").map((entry) => entry.path)).toEqual([
    "packages/domain/contracts.ts",
  ]);
  expect(searchFiles(entries, "no-match")).toEqual([]);
});
