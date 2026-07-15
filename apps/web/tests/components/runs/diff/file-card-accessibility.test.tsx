// @vitest-environment happy-dom
import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// happy-dom has no canvas 2d context; the lib measures line-number width with it.
HTMLCanvasElement.prototype.getContext = (() => ({
  font: "",
  measureText: (text: string) => ({ width: text.length * 7 }),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

const hunk = `diff --git a/src/index.ts b/src/index.ts
index 0000001..0000002 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
 line one
-line two
+line two changed
 line three
`;

async function renderDiff() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <DiffView
        data={{
          oldFile: { fileName: "src/index.ts" },
          newFile: { fileName: "src/index.ts" },
          hunks: [hunk],
        }}
        diffViewMode={DiffModeEnum.Unified}
        diffViewHighlight={false}
        diffViewFontSize={12}
        diffViewAddWidget
        renderWidgetLine={({ side, lineNumber }) => (
          <p data-testid="comment-widget">{`widget open: ${SplitSide[side]} ${lineNumber}`}</p>
        )}
      />,
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

describe("diff comment trigger accessibility (patched @git-diff-view/react)", () => {
  it("renders add-comment triggers as native buttons with line-specific labels", async () => {
    const { container, cleanup } = await renderDiff();

    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".diff-add-widget")];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.type).toBe("button");
      expect(button.getAttribute("aria-label")).toMatch(/^Add comment on line \d+$/);
    }

    await cleanup();
  });

  it("opens the comment widget from a click event, so keyboard activation works natively", async () => {
    const { container, cleanup } = await renderDiff();

    const newSideButton = container.querySelector<HTMLButtonElement>(
      '[data-add-widget="new"] .diff-add-widget',
    );
    if (newSideButton === null) throw new Error("no new-side add-comment trigger rendered");
    expect(container.querySelector('tr[data-state="widget"]')).toBeNull();

    await act(async () => {
      newSideButton.click();
    });

    // happy-dom reports zero layout width, which gates the widget's inner content;
    // the widget row itself proves the click reached the lib's open-widget state.
    expect(container.querySelector('tr[data-state="widget"]')).not.toBeNull();

    await cleanup();
  });
});
