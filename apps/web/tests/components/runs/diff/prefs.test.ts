import {
  DEFAULT_DIFF_PREFS,
  readDiffPrefs,
  writeDiffPrefs,
} from "@web/components/runs/diff/prefs/prefs";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("reviewer preferences", () => {
  it("defaults to unified, the file list, path order and visible statistics", () => {
    expect(readDiffPrefs(memoryStorage())).toEqual({
      mode: "unified",
      browser: "files",
      sort: "path",
      wrap: false,
      stats: true,
      hideReviewed: false,
    });
  });

  it("round-trips every preference through one stored record", () => {
    const storage = memoryStorage();
    writeDiffPrefs(
      {
        mode: "split",
        browser: "tree",
        sort: "changes",
        wrap: true,
        stats: false,
        hideReviewed: true,
      },
      storage,
    );

    expect(readDiffPrefs(storage)).toEqual({
      mode: "split",
      browser: "tree",
      sort: "changes",
      wrap: true,
      stats: false,
      hideReviewed: true,
    });
  });

  it("keeps the readable fields when one of them is corrupt", () => {
    const storage = memoryStorage();
    storage.setItem(
      "otomat.diff-prefs",
      JSON.stringify({ mode: "sideways", browser: "tree", wrap: "yes" }),
    );

    const prefs = readDiffPrefs(storage);

    expect(prefs.mode).toBe("unified");
    expect(prefs.browser).toBe("tree");
    expect(prefs.wrap).toBe(false);
  });

  it("falls back to the defaults on unparseable storage", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.diff-prefs", "{not json");
    expect(readDiffPrefs(storage)).toEqual(DEFAULT_DIFF_PREFS);
  });
});
