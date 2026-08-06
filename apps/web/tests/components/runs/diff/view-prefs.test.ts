import {
  readDiffBrowserMode,
  readDiffViewMode,
  writeDiffBrowserMode,
  writeDiffViewMode,
} from "@web/components/runs/diff/view-prefs";
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

describe("diff file browser mode preference", () => {
  it("defaults to the flat file list without a stored value", () => {
    expect(readDiffBrowserMode(memoryStorage())).toBe("files");
  });

  it("survives closing and reopening the reviewer", () => {
    const storage = memoryStorage();
    writeDiffBrowserMode("tree", storage);
    expect(readDiffBrowserMode(storage)).toBe("tree");
  });

  it("falls back to the file list on a corrupt stored value", () => {
    const storage = memoryStorage();
    storage.setItem("otomat.diff-browser-mode", "outline");
    expect(readDiffBrowserMode(storage)).toBe("files");
  });

  it("keeps the two view preferences on separate keys", () => {
    const storage = memoryStorage();
    writeDiffViewMode("split", storage);
    writeDiffBrowserMode("tree", storage);
    expect(readDiffViewMode(storage)).toBe("split");
    expect(readDiffBrowserMode(storage)).toBe("tree");
  });
});
