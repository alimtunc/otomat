import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolvePreviewDataRoot } from "#main/preview/data-root";

describe("resolvePreviewDataRoot", () => {
  it("gives a packaged unsigned build its own root beside the stable install", () => {
    const root = resolvePreviewDataRoot({
      packaged: true,
      signed: false,
      prNumber: null,
      appData: "/appdata",
    });

    expect(root).toBe(join("/appdata", "Otomat Preview"));
    expect(root).not.toBe(join("/appdata", "Otomat"));
  });

  it("splits previews per pull request so two under test share nothing", () => {
    const first = resolvePreviewDataRoot({
      packaged: true,
      signed: false,
      prNumber: 77,
      appData: "/appdata",
    });
    const second = resolvePreviewDataRoot({
      packaged: true,
      signed: false,
      prNumber: 78,
      appData: "/appdata",
    });

    expect(first).toBe(join("/appdata", "Otomat Preview PR 77"));
    expect(second).toBe(join("/appdata", "Otomat Preview PR 78"));
    expect(first).not.toBe(second);
  });

  it("keeps a signed release in the production location", () => {
    expect(
      resolvePreviewDataRoot({ packaged: true, signed: true, prNumber: null, appData: "/appdata" }),
    ).toBeNull();
  });

  it("leaves dev builds to the dev data root", () => {
    expect(
      resolvePreviewDataRoot({ packaged: false, signed: false, prNumber: 77, appData: "/appdata" }),
    ).toBeNull();
  });
});
