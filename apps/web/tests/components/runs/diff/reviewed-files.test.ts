import {
  pruneFingerprints,
  readReviewedFingerprints,
  reviewedPaths,
  writeReviewedFingerprints,
} from "@web/components/runs/diff/reviewed-files";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

const FILES = [
  { path: "a.ts", sha: "sha-a" },
  { path: "b.ts", sha: "sha-b" },
];

describe("reviewed file fingerprints", () => {
  it("round-trips the sha each file was reviewed at", () => {
    const storage = memoryStorage();
    writeReviewedFingerprints("run-1", { "a.ts": "sha-a" }, storage);
    expect(readReviewedFingerprints("run-1", storage)).toEqual({ "a.ts": "sha-a" });
  });

  it("keeps runs independent", () => {
    const storage = memoryStorage();
    writeReviewedFingerprints("run-1", { "a.ts": "sha-a" }, storage);
    writeReviewedFingerprints("run-2", { "b.ts": "sha-b" }, storage);
    expect(readReviewedFingerprints("run-1", storage)).toEqual({ "a.ts": "sha-a" });
    expect(readReviewedFingerprints("run-2", storage)).toEqual({ "b.ts": "sha-b" });
  });

  it("clears a run's entry when no path is reviewed", () => {
    const storage = memoryStorage();
    writeReviewedFingerprints("run-1", { "a.ts": "sha-a" }, storage);
    writeReviewedFingerprints("run-1", {}, storage);
    expect(storage.getItem("otomat.reviewed-files")).toBe("{}");
  });

  it("survives corrupt stored JSON", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.reviewed-files", "{not json");
    expect(readReviewedFingerprints("run-1", storage)).toEqual({});
    writeReviewedFingerprints("run-1", { "a.ts": "sha-a" }, storage);
    expect(readReviewedFingerprints("run-1", storage)).toEqual({ "a.ts": "sha-a" });
  });

  it("prunes the oldest runs beyond the retention cap", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 41; index += 1) {
      writeReviewedFingerprints(`run-${index}`, { "a.ts": "sha-a" }, storage);
    }
    expect(readReviewedFingerprints("run-0", storage)).toEqual({});
    expect(readReviewedFingerprints("run-40", storage)).toEqual({ "a.ts": "sha-a" });
  });
});

describe("reviewed marks against a live diff", () => {
  it("keeps a file reviewed while its patch is byte-identical", () => {
    expect(reviewedPaths({ "a.ts": "sha-a", "b.ts": "sha-b" }, FILES)).toEqual(
      new Set(["a.ts", "b.ts"]),
    );
  });

  it("only clears the files a new head actually moved", () => {
    const nextHead = [
      { path: "a.ts", sha: "sha-a" },
      { path: "b.ts", sha: "sha-b2" },
    ];
    expect(reviewedPaths({ "a.ts": "sha-a", "b.ts": "sha-b" }, nextHead)).toEqual(
      new Set(["a.ts"]),
    );
  });

  it("drops marks for files that left the diff", () => {
    expect(pruneFingerprints({ "a.ts": "sha-a", "gone.ts": "sha-g" }, FILES)).toEqual({
      "a.ts": "sha-a",
    });
  });
});
