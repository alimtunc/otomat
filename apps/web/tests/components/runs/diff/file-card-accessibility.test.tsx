// @vitest-environment happy-dom
import { DiffModeEnum, DiffView, SplitSide } from "@git-diff-view/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { mount } from "#support/mount";

stubDiffCanvas();

function renderDiff() {
  return mount(
    <DiffView
      data={{
        oldFile: { fileName: "src/index.ts" },
        newFile: { fileName: "src/index.ts" },
        hunks: [MODIFIED_FILE_PATCH],
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
