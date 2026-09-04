// @vitest-environment happy-dom
import { DiffPrefsPopover } from "@web/components/runs/diff/prefs/popover";
import { DEFAULT_DIFF_PREFS, type DiffPrefs } from "@web/components/runs/diff/prefs/prefs";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

async function openPopover(browsable: boolean, patches: Partial<DiffPrefs>[]) {
  const mounted = await mount(
    <DiffPrefsPopover
      prefs={DEFAULT_DIFF_PREFS}
      onChange={(patch) => patches.push(patch)}
      browsable={browsable}
    />,
  );
  await act(async () => {
    findButton("View")?.click();
  });
  return mounted;
}

describe("reviewer preferences popover", () => {
  it("marks the active browser mode", async () => {
    const { cleanup } = await openPopover(true, []);

    expect(findButton("Files")?.getAttribute("aria-pressed")).toBe("true");
    expect(findButton("Tree")?.getAttribute("aria-pressed")).toBe("false");
    await cleanup();
  });

  it("reports the chosen browser mode so the view can persist it", async () => {
    const patches: Partial<DiffPrefs>[] = [];
    const { cleanup } = await openPopover(true, patches);

    await act(async () => {
      findButton("Tree")?.click();
    });

    expect(patches).toEqual([{ browser: "tree" }]);
    await cleanup();
  });

  it("offers no browser control when the layout shows no file sidebar", async () => {
    const { cleanup } = await openPopover(false, []);

    expect(findButton("Files")).toBeUndefined();
    expect(findButton("Tree")).toBeUndefined();
    expect(findButton("Unified")).toBeDefined();
    await cleanup();
  });

  it("offers file-type grouping and reports the choice so the view can persist it", async () => {
    const patches: Partial<DiffPrefs>[] = [];
    const { cleanup } = await openPopover(true, patches);

    expect(findButton("None")?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      findButton("File type")?.click();
    });

    expect(patches).toEqual([{ grouping: "type" }]);
    await cleanup();
  });

  it("reports the default comment destination so a new comment starts there", async () => {
    const patches: Partial<DiffPrefs>[] = [];
    const { cleanup } = await openPopover(true, patches);

    await act(async () => {
      findButton("PR review")?.click();
    });

    expect(patches).toEqual([{ commentDestination: "pr_review" }]);
    await cleanup();
  });
});
