// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard, type DiffFileCardProps } from "@web/components/runs/diff/files/card";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { diffFileCardProps } from "#support/diff-card";
import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { diffFile } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

const file = diffFile({
  path: "src/index.ts",
  deletions: 1,
  patch: MODIFIED_FILE_PATCH,
  sha: "file-sha",
});

function renderCard(overrides: Partial<DiffFileCardProps> = {}) {
  return mountWithQuery(
    <ThemeProvider>
      <DiffFileCard {...diffFileCardProps({ file, ...overrides })} />
    </ThemeProvider>,
  );
}

function reviewedCheckbox(container: HTMLElement): HTMLElement {
  const checkbox = container.querySelector<HTMLElement>('[role="checkbox"]');
  if (checkbox === null) throw new Error("no reviewed checkbox rendered");
  return checkbox;
}

describe("diff file card controls and body", () => {
  it("renders the diff body and an unchecked Reviewed control by default", async () => {
    const { container, cleanup } = await renderCard();
    expect(container.querySelector(".diff-view-wrapper")).not.toBeNull();
    expect(reviewedCheckbox(container).getAttribute("aria-checked")).toBe("false");
    await cleanup();
  });

  it("keeps a reviewed file's body on screen until collapse asks for it to go", async () => {
    const { container, cleanup } = await renderCard({ reviewed: true });
    expect(reviewedCheckbox(container).getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector(".diff-view-wrapper")).not.toBeNull();
    await cleanup();
  });

  it("hides the body when collapsed, keeping the sticky header and the Reviewed mark", async () => {
    const { container, cleanup } = await renderCard({ collapsed: true, reviewed: true });
    expect(container.querySelector(".diff-view-wrapper")).toBeNull();
    expect(container.textContent).toContain("src/index.ts");
    expect(reviewedCheckbox(container).getAttribute("aria-checked")).toBe("true");
    await cleanup();
  });

  it("reports collapse without touching Reviewed", async () => {
    const onCollapsedChange = vi.fn();
    const onReviewedChange = vi.fn();
    const { container, cleanup } = await renderCard({ onCollapsedChange, onReviewedChange });
    const toggle = container.querySelector<HTMLElement>('[aria-label="Collapse src/index.ts"]');
    if (toggle === null) throw new Error("no collapse control rendered");

    await act(async () => {
      toggle.click();
    });

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(onReviewedChange).not.toHaveBeenCalled();
    await cleanup();
  });

  it("reports a reviewed toggle from the header control", async () => {
    const onReviewedChange = vi.fn();
    const { container, cleanup } = await renderCard({ onReviewedChange });

    await act(async () => {
      reviewedCheckbox(container).click();
    });

    expect(onReviewedChange).toHaveBeenCalledWith(true);
    await cleanup();
  });

  it("selects the file when the reader clicks inside the panel", async () => {
    const onActivate = vi.fn();
    const { container, cleanup } = await renderCard({ onActivate });
    const body = container.querySelector<HTMLElement>(".diff-view-wrapper");
    if (body === null) throw new Error("no diff body rendered");

    await act(async () => {
      body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(onActivate).toHaveBeenCalled();
    await cleanup();
  });

  it("renders side-by-side columns only in split mode", async () => {
    const unified = await renderCard({ prefs: { ...DEFAULT_DIFF_PREFS, mode: "unified" } });
    expect(unified.container.querySelector(".diff-table-old-content-col")).toBeNull();
    await unified.cleanup();

    const split = await renderCard({ prefs: { ...DEFAULT_DIFF_PREFS, mode: "split" } });
    expect(split.container.querySelector(".diff-table-old-content-col")).not.toBeNull();
    await split.cleanup();
  });
});
