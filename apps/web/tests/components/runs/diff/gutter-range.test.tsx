// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCardBody } from "@web/components/runs/diff/files/card-body";
import type { DiffViewMode } from "@web/components/runs/diff/prefs/prefs";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { fileCommentActions, fileCommentsProp } from "#support/diff-card";
import { stubDiffCanvas, stubDiffLayout } from "#support/diff-dom";
import { setTextareaValue } from "#support/dom-events";
import { findButton, findLabelled } from "#support/dom-queries";
import { mount } from "#support/mount";

stubDiffCanvas();
stubDiffLayout();

/** Head lines 2–4 are `bravo`, `charlie`, `delta`; base lines 2–3 are `beta` and `gamma`. */
const FILE: DiffFileContract = {
  path: "notes.md",
  old_path: null,
  status: "modified",
  additions: 3,
  deletions: 1,
  binary: false,
  patch: [
    "diff --git a/notes.md b/notes.md",
    "index 1111111..2222222 100644",
    "--- a/notes.md",
    "+++ b/notes.md",
    "@@ -1,4 +1,6 @@",
    " alpha",
    "-beta",
    "+bravo",
    "+charlie",
    "+delta",
    " gamma",
    " omega",
  ].join("\n"),
  sha: "file-sha",
};

function renderBody(mode: DiffViewMode, add = vi.fn(async () => {})) {
  return mount(
    <ThemeProvider>
      <DiffFileCardBody
        file={FILE}
        mode={mode}
        wrap={false}
        highlight={false}
        context={null}
        expandAll={false}
        comments={fileCommentsProp()}
        commentActions={fileCommentActions({ add })}
      />
    </ThemeProvider>,
  );
}

/** Lets a test flip the layout the way the diff toolbar does. */
function LayoutHarness() {
  const [mode, setMode] = useState<DiffViewMode>("unified");
  const [wrap, setWrap] = useState(false);
  return (
    <ThemeProvider>
      <button type="button" onClick={() => setMode("split")}>
        Switch to split
      </button>
      <button type="button" onClick={() => setWrap(true)}>
        Wrap lines
      </button>
      <DiffFileCardBody
        file={FILE}
        mode={mode}
        wrap={wrap}
        highlight={false}
        context={null}
        expandAll={false}
        comments={fileCommentsProp()}
        commentActions={fileCommentActions({ add: vi.fn(async () => {}) })}
      />
    </ThemeProvider>
  );
}

function gutter(container: HTMLElement, mode: DiffViewMode, side: "old" | "new", line: number) {
  const selector =
    mode === "split"
      ? `.diff-line-${side}-num span[data-line-num="${line}"]`
      : `span[data-line-${side === "new" ? "new" : "old"}-num="${line}"]`;
  const cell = container.querySelector(selector)?.closest("td");
  if (!cell) throw new Error(`no ${side} gutter cell for line ${line} in ${mode} view`);
  return cell;
}

async function drag(from: Element, over: Element[]): Promise<void> {
  await act(async () => {
    from.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    for (const cell of over) cell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

async function shiftClick(cell: Element): Promise<void> {
  await act(async () => {
    cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, shiftKey: true }));
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
}

function composers(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('textarea[aria-label="Review comment"]')].map(
    (field) => {
      const form = field.closest("form");
      if (!form) throw new Error("comment composer form not found");
      return form;
    },
  );
}

function composerBody(container: HTMLElement): HTMLTextAreaElement {
  const body = container.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Review comment"]',
  );
  if (body === null) throw new Error("no composer is open");
  return body;
}

function anchorLabel(container: HTMLElement): string {
  const composer = composers(container)[0];
  if (composer === undefined) throw new Error("no composer is open");
  return composer.textContent?.split("Comment")[0] ?? "";
}

function markedLines(container: HTMLElement, mode: DiffViewMode): number[] {
  const attribute = mode === "split" ? "data-line-num" : "data-line-new-num";
  const cells =
    mode === "split" ? ".diff-multi-select-active.diff-line-new-num" : ".diff-multi-select-active";
  return [...container.querySelectorAll(`${cells} span[${attribute}]`)]
    .map((span) => Number(span.getAttribute(attribute)))
    .toSorted((a, b) => a - b);
}

describe("diff gutter range selection", () => {
  it("opens one composer on the whole dragged range, not on its last line", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [
      gutter(container, "unified", "new", 3),
      gutter(container, "unified", "new", 4),
    ]);

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · lines 2–4 · head side");
    await cleanup();
  });

  it("marks every line the drag covers", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [
      gutter(container, "unified", "new", 3),
      gutter(container, "unified", "new", 4),
    ]);

    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    await cleanup();
  });

  it("extends and reduces the open range on shift+click, from its anchor", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 3)]);
    expect(anchorLabel(container)).toContain("lines 2–3");

    await shiftClick(gutter(container, "unified", "new", 6));
    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("lines 2–6");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4, 5, 6]);

    await shiftClick(gutter(container, "unified", "new", 3));
    expect(anchorLabel(container)).toContain("lines 2–3");
    expect(markedLines(container, "unified")).toEqual([2, 3]);
    await cleanup();
  });

  it("reduces a range drawn by a drag, marks and all", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 6)]);
    expect(markedLines(container, "unified")).toEqual([2, 3, 4, 5, 6]);

    await shiftClick(gutter(container, "unified", "new", 3));

    expect(anchorLabel(container)).toContain("lines 2–3");
    expect(markedLines(container, "unified")).toEqual([2, 3]);
    await cleanup();
  });

  it("extends upward, where the composer keeps its row", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 4), []);
    expect(anchorLabel(container)).toContain("line 4");

    await shiftClick(gutter(container, "unified", "new", 2));

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("lines 2–4");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    await cleanup();
  });

  it("keeps the body typed before the range grew, and sends the grown range", async () => {
    const add = vi.fn(async () => {});
    const { container, cleanup } = await renderBody("unified", add);

    await drag(gutter(container, "unified", "new", 4), []);
    await act(async () => setTextareaValue(composerBody(container), "rework these"));

    await shiftClick(gutter(container, "unified", "new", 2));

    expect(anchorLabel(container)).toContain("lines 2–4");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    await act(async () => {
      findButton("Add comment")?.click();
    });

    expect(add).toHaveBeenCalledWith(
      FILE,
      expect.objectContaining({ side: "new", start_line: 2, line: 4, body: "rework these" }),
    );
    await cleanup();
  });

  it("keeps the typed body when shift+click extends the range downward", async () => {
    const add = vi.fn(async () => {});
    const { container, cleanup } = await renderBody("unified", add);

    await drag(gutter(container, "unified", "new", 2), []);
    await act(async () => setTextareaValue(composerBody(container), "hold this"));

    await shiftClick(gutter(container, "unified", "new", 4));

    expect(anchorLabel(container)).toContain("lines 2–4");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    await act(async () => {
      findButton("Add comment")?.click();
    });

    expect(add).toHaveBeenCalledWith(
      FILE,
      expect.objectContaining({ side: "new", start_line: 2, line: 4, body: "hold this" }),
    );
    await cleanup();
  });

  it("moves an edge from the keyboard, marks and composer row included", async () => {
    const add = vi.fn(async () => {});
    const { container, cleanup } = await renderBody("unified", add);

    await drag(gutter(container, "unified", "new", 3), []);
    await act(async () => {
      findLabelled("Move the range end down one line")?.click();
    });

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("lines 3–4");
    expect(markedLines(container, "unified")).toEqual([3, 4]);

    await act(async () => setTextareaValue(composerBody(container), "widened"));
    await act(async () => {
      findButton("Add comment")?.click();
    });

    expect(add).toHaveBeenCalledWith(
      FILE,
      expect.objectContaining({ side: "new", start_line: 3, line: 4 }),
    );
    await cleanup();
  });

  it("keeps a single click on one line", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 3), []);

    expect(anchorLabel(container)).toContain("notes.md · line 3 · head side");
    expect(markedLines(container, "unified")).toEqual([3]);
    await cleanup();
  });

  it("clears the range and its marks when the composer is closed", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => {
      findButton("Cancel")?.click();
    });

    expect(composers(container)).toHaveLength(0);
    expect(markedLines(container, "unified")).toEqual([]);
    await cleanup();
  });

  it("anchors the add-comment button on its own line, whatever was selected before", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.diff-add-widget[aria-label="Add comment on line 6"]')
        ?.click();
    });

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · line 6 · head side");
    await cleanup();
  });

  it("keeps the range when the add-comment button sits on its end line", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.diff-add-widget[aria-label="Add comment on line 4"]')
        ?.click();
    });

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · lines 2–4 · head side");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    await cleanup();
  });

  it("sends the dragged range as the comment's anchor", async () => {
    const add = vi.fn(async () => {});
    const { container, cleanup } = await renderBody("unified", add);

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => setTextareaValue(composerBody(container), "rework these three"));
    await act(async () => {
      findButton("Add comment")?.click();
    });

    expect(add).toHaveBeenCalledWith(
      FILE,
      expect.objectContaining({ side: "new", start_line: 2, line: 4 }),
    );
    await cleanup();
  });

  it("prefills a suggestion with the head lines the dragged range covers", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => {
      findButton("Suggest change")?.click();
    });

    const suggestion = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Suggested replacement"]',
    );
    expect(suggestion?.value).toBe("bravo\ncharlie\ndelta");
    await cleanup();
  });

  it("selects a range in the split view too", async () => {
    const { container, cleanup } = await renderBody("split");

    await drag(gutter(container, "split", "new", 2), [
      gutter(container, "split", "new", 3),
      gutter(container, "split", "new", 4),
    ]);

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · lines 2–4 · head side");
    await cleanup();
  });

  it("leaves the base gutter inert in split view, head anchor and marks untouched", async () => {
    const { container, cleanup } = await renderBody("split");

    await drag(gutter(container, "split", "new", 2), [gutter(container, "split", "new", 3)]);
    await drag(gutter(container, "split", "old", 2), [gutter(container, "split", "old", 3)]);

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · lines 2–3 · head side");
    expect(markedLines(container, "split")).toEqual([2, 3]);
    await cleanup();
  });

  it("leaves a deleted line inert in unified view, where it is the base side", async () => {
    const { container, cleanup } = await renderBody("unified");

    await drag(gutter(container, "unified", "old", 2), []);

    expect(composers(container)).toHaveLength(0);
    expect(container.querySelectorAll(".diff-multi-select-active")).toHaveLength(0);
    await cleanup();
  });

  it("carries the selection into the other view when the mode switches", async () => {
    const { container, cleanup } = await mount(<LayoutHarness />);

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => {
      findButton("Switch to split")?.click();
    });

    expect(composers(container)).toHaveLength(1);
    expect(anchorLabel(container)).toContain("notes.md · lines 2–4 · head side");
    expect(markedLines(container, "split")).toEqual([2, 3, 4]);
    await cleanup();
  });

  it("keeps the marks and the open composer across a wrap toggle", async () => {
    const { container, cleanup } = await mount(<LayoutHarness />);

    await drag(gutter(container, "unified", "new", 2), [gutter(container, "unified", "new", 4)]);
    await act(async () => setTextareaValue(composerBody(container), "still here"));
    await act(async () => {
      findButton("Wrap lines")?.click();
    });

    expect(anchorLabel(container)).toContain("lines 2–4");
    expect(markedLines(container, "unified")).toEqual([2, 3, 4]);
    expect(composerBody(container).value).toBe("still here");
    await cleanup();
  });
});
