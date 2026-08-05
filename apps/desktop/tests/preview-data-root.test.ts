import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolvePreviewDataRoot } from "#main/preview-data-root";

describe("resolvePreviewDataRoot", () => {
  it("gives a packaged unsigned build its own root beside the stable install", () => {
    const root = resolvePreviewDataRoot({ packaged: true, signed: false, appData: "/appdata" });

    expect(root).toBe(join("/appdata", "Otomat Preview"));
    expect(root).not.toBe(join("/appdata", "Otomat"));
  });

  it("keeps a signed release in the production location", () => {
    expect(
      resolvePreviewDataRoot({ packaged: true, signed: true, appData: "/appdata" }),
    ).toBeNull();
  });

  it("leaves dev builds to the dev data root", () => {
    expect(
      resolvePreviewDataRoot({ packaged: false, signed: false, appData: "/appdata" }),
    ).toBeNull();
  });
});
