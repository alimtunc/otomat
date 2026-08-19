import {
  adjacentFile,
  clampBlockIndex,
  nextUnreviewedFile,
} from "@web/components/runs/diff/diff-nav";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";

const files = [diffFile({ path: "a.ts" }), diffFile({ path: "b.ts" }), diffFile({ path: "c.ts" })];

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

describe("nextUnreviewedFile", () => {
  it("steps to the next file still unreviewed", () => {
    expect(nextUnreviewedFile(files, "a.ts", new Set())?.path).toBe("b.ts");
  });

  it("skips the files already reviewed", () => {
    expect(nextUnreviewedFile(files, "a.ts", new Set(["b.ts"]))?.path).toBe("c.ts");
  });

  it("wraps to an unreviewed file left behind", () => {
    expect(nextUnreviewedFile(files, "c.ts", new Set(["b.ts"]))?.path).toBe("a.ts");
  });

  it("returns null when nothing but the marked file is left", () => {
    expect(nextUnreviewedFile(files, "b.ts", new Set(["a.ts", "c.ts"]))).toBeNull();
    expect(nextUnreviewedFile([files[0]], "a.ts", new Set())).toBeNull();
    expect(nextUnreviewedFile([], "a.ts", new Set())).toBeNull();
  });
});
