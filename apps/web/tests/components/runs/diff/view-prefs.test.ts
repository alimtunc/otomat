import { readDiffViewMode, writeDiffViewMode } from "@web/components/runs/diff/view-prefs";
import { describe, expect, it } from "vitest";

import { memoryStorage } from "#support/storage";

describe("diff view mode preference", () => {
  it("defaults to unified without a stored value", () => {
    expect(readDiffViewMode(memoryStorage())).toBe("unified");
  });

  it("round-trips split through storage", () => {
    const storage = memoryStorage();
    writeDiffViewMode("split", storage);
    expect(readDiffViewMode(storage)).toBe("split");
  });

  it("falls back to unified on a corrupt stored value", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.diff-view-mode", "sideways");
    expect(readDiffViewMode(storage)).toBe("unified");
  });
});
