// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard, type DiffFileCardProps } from "@web/components/runs/diff/file-card";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { mount } from "#support/mount";

stubDiffCanvas();

const file: DiffFileContract = {
  path: "src/index.ts",
  old_path: null,
  status: "modified",
  additions: 1,
  deletions: 1,
  binary: false,
  patch: MODIFIED_FILE_PATCH,
  sha: "file-sha",
};

function renderCard(overrides: Partial<DiffFileCardProps> = {}) {
  return mount(
    <ThemeProvider>
      <DiffFileCard
        file={file}
        mode="unified"
        reviewed={false}
        onReviewedChange={() => {}}
        commentsByLine={new Map()}
        onAddComment={async () => {}}
        selectedCommentIds={new Set()}
        onToggleComment={() => {}}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

describe("DiffFileCard reviewed state and view mode", () => {
  it("renders the diff body and an unchecked Reviewed control by default", async () => {
    const { container, cleanup } = await renderCard();
    expect(container.querySelector(".diff-view-wrapper")).not.toBeNull();
    const checkbox = container.querySelector('[role="checkbox"]');
    expect(checkbox?.getAttribute("aria-checked")).toBe("false");
    await cleanup();
  });

  it("collapses the diff body when reviewed, keeping the header", async () => {
    const { container, cleanup } = await renderCard({ reviewed: true });
    expect(container.querySelector(".diff-view-wrapper")).toBeNull();
    expect(container.textContent).toContain("src/index.ts");
    expect(container.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    await cleanup();
  });

  it("reports a reviewed toggle from the header control", async () => {
    const onReviewedChange = vi.fn();
    const { container, cleanup } = await renderCard({ onReviewedChange });
    const checkbox = container.querySelector<HTMLElement>('[role="checkbox"]');
    if (checkbox === null) throw new Error("no reviewed checkbox rendered");
    await act(async () => {
      checkbox.click();
    });
    expect(onReviewedChange).toHaveBeenCalledWith(true);
    await cleanup();
  });

  it("renders side-by-side columns only in split mode", async () => {
    const unified = await renderCard({ mode: "unified" });
    expect(unified.container.querySelector(".diff-table-old-content-col")).toBeNull();
    await unified.cleanup();

    const split = await renderCard({ mode: "split" });
    expect(split.container.querySelector(".diff-table-old-content-col")).not.toBeNull();
    await split.cleanup();
  });
});
