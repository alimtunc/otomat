import { readReviewedFiles, writeReviewedFiles } from "@web/components/runs/diff/reviewed-files";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("reviewed files persistence", () => {
  it("round-trips reviewed paths for a run and sha", () => {
    const storage = memoryStorage();
    writeReviewedFiles("run-1", "sha-a", new Set(["a.ts", "b.ts"]), storage);
    expect(readReviewedFiles("run-1", "sha-a", storage)).toEqual(new Set(["a.ts", "b.ts"]));
  });

  it("never presents marks stored for another diff sha", () => {
    const storage = memoryStorage();
    writeReviewedFiles("run-1", "sha-a", new Set(["a.ts"]), storage);
    expect(readReviewedFiles("run-1", "sha-b", storage)).toEqual(new Set());
  });

  it("keeps runs independent", () => {
    const storage = memoryStorage();
    writeReviewedFiles("run-1", "sha-a", new Set(["a.ts"]), storage);
    writeReviewedFiles("run-2", "sha-a", new Set(["b.ts"]), storage);
    expect(readReviewedFiles("run-1", "sha-a", storage)).toEqual(new Set(["a.ts"]));
    expect(readReviewedFiles("run-2", "sha-a", storage)).toEqual(new Set(["b.ts"]));
  });

  it("clears a run's entry when no path is reviewed", () => {
    const storage = memoryStorage();
    writeReviewedFiles("run-1", "sha-a", new Set(["a.ts"]), storage);
    writeReviewedFiles("run-1", "sha-a", new Set(), storage);
    expect(storage.getItem("otomat.reviewed-files")).toBe("{}");
  });

  it("survives corrupt stored JSON", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.reviewed-files", "{not json");
    expect(readReviewedFiles("run-1", "sha-a", storage)).toEqual(new Set());
    writeReviewedFiles("run-1", "sha-a", new Set(["a.ts"]), storage);
    expect(readReviewedFiles("run-1", "sha-a", storage)).toEqual(new Set(["a.ts"]));
  });

  it("prunes the oldest runs beyond the retention cap", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 41; index += 1) {
      writeReviewedFiles(`run-${index}`, "sha", new Set(["a.ts"]), storage);
    }
    expect(readReviewedFiles("run-0", "sha", storage)).toEqual(new Set());
    expect(readReviewedFiles("run-40", "sha", storage)).toEqual(new Set(["a.ts"]));
  });
});
