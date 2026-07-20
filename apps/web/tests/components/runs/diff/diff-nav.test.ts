import type { DiffFileContract } from "@otomat/domain";
import { adjacentFile, clampBlockIndex } from "@web/components/runs/diff/diff-nav";
import { describe, expect, it } from "vitest";

function file(path: string): DiffFileContract {
  return {
    path,
    old_path: null,
    status: "modified",
    additions: 1,
    deletions: 0,
    binary: false,
    patch: "",
    sha: `sha-${path}`,
  };
}

const files = [file("a.ts"), file("b.ts"), file("c.ts")];

describe("adjacentFile", () => {
  it("starts at the first file when stepping forward with no active file", () => {
    expect(adjacentFile(files, null, 1)?.path).toBe("a.ts");
  });

  it("starts at the last file when stepping backward with no active file", () => {
    expect(adjacentFile(files, null, -1)?.path).toBe("c.ts");
  });

  it("steps to the neighbouring file", () => {
    expect(adjacentFile(files, "a.ts", 1)?.path).toBe("b.ts");
    expect(adjacentFile(files, "b.ts", -1)?.path).toBe("a.ts");
  });

  it("stays put at the boundaries", () => {
    expect(adjacentFile(files, "c.ts", 1)).toBeNull();
    expect(adjacentFile(files, "a.ts", -1)).toBeNull();
  });

  it("treats an unknown active path like no selection", () => {
    expect(adjacentFile(files, "gone.ts", 1)?.path).toBe("a.ts");
  });

  it("returns null with no files", () => {
    expect(adjacentFile([], null, 1)).toBeNull();
  });
});

describe("clampBlockIndex", () => {
  it("enters the list at the first change block", () => {
    expect(clampBlockIndex(-1, 1, 3)).toBe(0);
  });

  it("clamps at both ends", () => {
    expect(clampBlockIndex(2, 1, 3)).toBe(2);
    expect(clampBlockIndex(0, -1, 3)).toBe(0);
  });

  it("returns -1 with no change blocks", () => {
    expect(clampBlockIndex(-1, 1, 0)).toBe(-1);
  });
});
