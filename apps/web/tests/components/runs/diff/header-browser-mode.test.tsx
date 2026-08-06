// @vitest-environment happy-dom
import type { RunDiffContract } from "@otomat/domain";
import { RunDiffHeader } from "@web/components/runs/diff/header";
import type { DiffBrowserMode } from "@web/components/runs/diff/view-prefs";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { diffFile } from "#support/diff-file";
import { findButton } from "#support/dom-queries";
import { mount } from "#support/mount";

const diff: RunDiffContract = {
  base: "base-sha",
  files: [diffFile({ path: "src/index.ts", sha: "file-sha" })],
  additions: 1,
  deletions: 0,
  sha: "diff-sha",
};

function renderHeader(browserMode: DiffBrowserMode | null, chosen: DiffBrowserMode[]) {
  return mount(
    <RunDiffHeader
      diff={diff}
      reviewStatus={null}
      mode="unified"
      onModeChange={() => {}}
      browserMode={browserMode}
      onBrowserModeChange={(next) => chosen.push(next)}
      reviewedCount={0}
    />,
  );
}

describe("reviewer header file browser control", () => {
  it("offers Files and Tree, marking the active one", async () => {
    const { cleanup } = await renderHeader("files", []);

    expect(findButton("Files")?.getAttribute("aria-pressed")).toBe("true");
    expect(findButton("Tree")?.getAttribute("aria-pressed")).toBe("false");
    await cleanup();
  });

  it("reports the chosen mode so the view can persist it", async () => {
    const chosen: DiffBrowserMode[] = [];
    const { cleanup } = await renderHeader("files", chosen);

    await act(async () => {
      findButton("Tree")?.click();
    });

    expect(chosen).toEqual(["tree"]);
    await cleanup();
  });

  it("offers no browser control when the layout shows no file sidebar", async () => {
    const { cleanup } = await renderHeader(null, []);

    expect(findButton("Files")).toBeUndefined();
    expect(findButton("Tree")).toBeUndefined();
    expect(findButton("Unified")).toBeDefined();
    await cleanup();
  });
});
