// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard, type DiffFileCardProps } from "@web/components/runs/diff/file-card";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// happy-dom has no canvas 2d context; the lib measures line-number width with it.
HTMLCanvasElement.prototype.getContext = (() => ({
  font: "",
  measureText: (text: string) => ({ width: text.length * 7 }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

const patch = `diff --git a/src/index.ts b/src/index.ts
index 0000001..0000002 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
 line one
-line two
+line two changed
 line three
`;

const file: DiffFileContract = {
  path: "src/index.ts",
  old_path: null,
  status: "modified",
  additions: 1,
  deletions: 1,
  binary: false,
  patch,
  sha: "file-sha",
};

async function renderCard(overrides: Partial<DiffFileCardProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
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
  });
  const cleanup = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  return { container, cleanup };
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
