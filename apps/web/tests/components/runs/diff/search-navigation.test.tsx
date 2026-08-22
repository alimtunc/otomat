// @vitest-environment happy-dom
import type { ReviewDiffContract, ReviewedFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { ReviewWorkbench } from "@web/components/runs/diff/review-workbench";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  diffCardsOf,
  domRect,
  overflowLonghandStyle,
  stubDiffCanvas,
  stubHighlightApi,
} from "#support/diff-dom";
import { diffFile, diffPatch } from "#support/diff-file";
import { setInputValue } from "#support/dom-events";
import { mountWithQuery } from "#support/mount";
import { reviewDetail } from "#support/review-detail";
import { reviewedFile } from "#support/reviewed-file";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

stubDiffCanvas();

const highlights = stubHighlightApi();

const styles = overflowLonghandStyle();

const VIEWPORT = 400;
const CARD = 300;
const ROW_TOP = 100;
const ROW_HEIGHT = 16;
const SOLO = "src/a.ts";
const PATHS = [SOLO, "src/b.ts"];
const ADDED_LINE = "const answer = 42;";

const DIFF: ReviewDiffContract = {
  base: "base-sha",
  files: PATHS.map((path) => diffFile({ path, patch: diffPatch(path) })),
  additions: 2,
  deletions: 2,
  sha: "diff-sha",
};

const getDiffFileBlobs = vi.fn();

vi.mock("@web/api/client", () => ({ daemon: { getDiffFileBlobs: () => getDiffFileBlobs() } }));

vi.mock("@web/api/reviews/mutations", () => ({
  useAddReviewComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishReviewComment: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRequestFix: () => ({ mutate: vi.fn(), isPending: false }),
  useSetReviewedFile: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

vi.mock("@web/components/runs/diff/fix-bar", () => ({ DiffFixBar: () => null }));

const goBack = vi.fn();

vi.mock("@web/components/shell/use-back-navigation", () => ({
  useBackNavigation: () => ({ goBack }),
}));

/** The route owns the selection; this holds it the same way, so the reveal is the code under test. */
vi.mock("@web/components/runs/diff/use-active-file", () => ({
  useActiveDiffFile: () => {
    const [path, setPath] = useState<string | null>(null);
    return { path, select: setPath };
  },
}));

function diffRows(card: HTMLElement): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>("tr.diff-line")];
}

/** Cards run down the scroller and rows run down their card, so a hit has its own offset. */
function layout(scroller: HTMLElement, scroll: ScrollControl): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === scroller) return domRect(0, VIEWPORT);
    const cards = diffCardsOf(scroller);
    const own = cards.findIndex((card) => card === this);
    if (own !== -1) return domRect(own * CARD - scroll.top(), CARD);
    const owner = cards.findIndex((card) => card.contains(this));
    const card = cards[owner];
    if (card === undefined) return domRect(0, 0);
    const row = this.closest<HTMLElement>("tr.diff-line");
    const index = row === null ? 0 : Math.max(0, diffRows(card).indexOf(row));
    return domRect(owner * CARD + ROW_TOP + index * ROW_HEIGHT - scroll.top(), ROW_HEIGHT);
  };
}

/** The row the search matched, found by its text rather than by the offset under test. */
function rowIndexOf(card: HTMLElement, text: string): number {
  return diffRows(card).findIndex((row) => row.textContent?.includes(text) === true);
}

function centeredTop(cardIndex: number, rowIndex: number): number {
  return cardIndex * CARD + ROW_TOP + rowIndex * ROW_HEIGHT - (VIEWPORT - ROW_HEIGHT) / 2;
}

const original = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  document.head.append(styles);
  window.localStorage.clear();
  getDiffFileBlobs.mockClear();
  goBack.mockClear();
  highlights.clear();
  diffPrefsStore.actions.set({ browser: "files", hideReviewed: false, mode: "unified" });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = original;
  styles.remove();
});

async function mountReviewer(reviewedFiles: ReviewedFileContract[] = [], diff = DIFF) {
  const mounted = await mountWithQuery(
    <ThemeProvider>
      <ReviewWorkbench
        target={{ kind: "pull_request", id: "pr-1" }}
        workspace={{ open: false, issueId: null }}
        diff={diff}
        review={reviewDetail(reviewedFiles)}
        notice={null}
      />
    </ThemeProvider>,
  );
  const scroller = mounted.container
    .querySelector<HTMLElement>("section[aria-label]")
    ?.closest<HTMLElement>(".overflow-auto");
  if (scroller === null || scroller === undefined) {
    throw new Error("the cards are not inside a scroll container");
  }
  const scroll = controlScroll(scroller, VIEWPORT, diff.files.length * CARD + VIEWPORT);
  layout(scroller, scroll);

  const field = mounted.container.querySelector<HTMLInputElement>(
    'input[aria-label="Find in the diff"]',
  );
  if (field === null) throw new Error("the reviewer toolbar shows no find field");

  const counter = (): string => {
    const live = mounted.container.querySelector('[aria-live="polite"]');
    if (live === null) throw new Error("the counter's live region is not mounted");
    return live.textContent ?? "";
  };
  const button = (label: string): HTMLButtonElement => {
    const found = mounted.container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (found === null) throw new Error(`no ${label} control`);
    return found;
  };

  return {
    ...mounted,
    scroller,
    scroll,
    field,
    counter,
    button,
    cards: () => diffCardsOf(scroller),
    type: async (value: string) => {
      await act(async () => {
        setInputValue(field, value);
      });
    },
    press: async (init: KeyboardEventInit, on: EventTarget = field): Promise<boolean> => {
      let prevented = false;
      await act(async () => {
        const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
        prevented = !on.dispatchEvent(event);
      });
      return prevented;
    },
    click: async (label: string) => {
      await act(async () => {
        button(label).click();
      });
    },
  };
}

describe("searching the loaded hunks from the reviewer toolbar", () => {
  it("counts every occurrence and walks them with the buttons, wrapping once", async () => {
    const view = await mountReviewer();

    await view.type("line");
    expect(view.counter()).toBe("1/4");

    await view.type("answer");
    expect(view.counter()).toBe("1/2");
    await view.click("Next match");
    expect(view.counter()).toBe("2/2");
    await view.click("Next match");
    expect(view.counter()).toBe("1/2");
    await view.click("Previous match");
    expect(view.counter()).toBe("2/2");

    await view.cleanup();
  });

  it("mounts the counter's live region before it has anything to announce", async () => {
    const view = await mountReviewer();

    expect(view.counter()).toBe("");
    expect(view.field.classList.contains("selection:bg-iris")).toBe(true);
    expect(view.field.classList.contains("selection:text-on-accent")).toBe(true);

    await view.cleanup();
  });

  it("steps backwards past the start, distinctly from forwards", async () => {
    const view = await mountReviewer();

    await view.type("line");
    expect(view.counter()).toBe("1/4");
    await view.click("Previous match");
    expect(view.counter()).toBe("4/4");
    await view.click("Previous match");
    expect(view.counter()).toBe("3/4");
    await view.click("Next match");
    expect(view.counter()).toBe("4/4");

    await view.cleanup();
  });

  it("walks with Enter and Shift+Enter", async () => {
    const view = await mountReviewer();
    await view.type("line");

    expect(await view.press({ key: "Enter" })).toBe(true);
    expect(view.counter()).toBe("2/4");
    await view.press({ key: "Enter", shiftKey: true });
    expect(view.counter()).toBe("1/4");
    await view.press({ key: "Enter", shiftKey: true });
    expect(view.counter()).toBe("4/4");

    await view.cleanup();
  });

  for (const [name, init] of [
    ["Cmd", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
  ] as const) {
    it(`takes ${name}+F from the browser and selects the field`, async () => {
      const view = await mountReviewer();
      await view.type("answer");
      view.field.blur();

      expect(await view.press({ key: "f", ...init }, window)).toBe(true);

      expect(document.activeElement).toBe(view.field);
      expect(view.field.selectionStart).toBe(0);
      expect(view.field.selectionEnd).toBe("answer".length);
      await view.cleanup();
    });
  }

  it("clears the query on Escape, from the field and from the diff", async () => {
    const view = await mountReviewer();

    await view.type("answer");
    await view.press({ key: "Escape" });
    expect(view.field.value).toBe("");
    expect(view.counter()).toBe("");

    await view.type("answer");
    await view.press({ key: "Escape" }, window);
    expect(view.field.value).toBe("");
    expect(goBack).not.toHaveBeenCalled();

    await view.press({ key: "Escape" }, window);
    expect(goBack).toHaveBeenCalledTimes(1);

    await view.cleanup();
  });

  it("reports no result without offering a step", async () => {
    const view = await mountReviewer();

    await view.type("nowhere-in-this-diff");

    expect(view.counter()).toBe("0/0");
    expect(view.button("Next match").disabled).toBe(true);
    expect(view.button("Previous match").disabled).toBe(true);
    await view.cleanup();
  });

  it("selects the active occurrence's file and centres its own row", async () => {
    const view = await mountReviewer();

    await view.type("answer");
    await view.click("Next match");

    const card = view.cards()[1];
    if (card === undefined) throw new Error("no card for src/b.ts");
    expect(card.getAttribute("aria-current")).toBe("true");
    expect(view.scroll.top()).toBe(centeredTop(1, rowIndexOf(card, ADDED_LINE)));
    await view.cleanup();
  });

  it("re-centres the sole match after the reader scrolls away from it", async () => {
    const view = await mountReviewer([], {
      ...DIFF,
      files: [diffFile({ path: SOLO, patch: diffPatch(SOLO) })],
    });

    await view.type("42;");
    expect(view.counter()).toBe("1/1");
    const landed = view.scroll.top();

    view.scroll.dragTo(view.scroll.maxTop());
    expect(view.scroll.top()).not.toBe(landed);
    await view.click("Next match");

    expect(view.scroll.top()).toBe(landed);
    await view.cleanup();
  });

  it("finds a collapsed file's hunks and expands it without touching Reviewed", async () => {
    const view = await mountReviewer([reviewedFile({ file_path: "src/b.ts" })]);
    const collapsed = view.cards()[1];
    if (collapsed === undefined) throw new Error("no card for src/b.ts");
    expect(collapsed.querySelector("tr.diff-line")).toBeNull();

    await view.type("answer");
    expect(view.counter()).toBe("1/2");

    await view.click("Next match");

    expect(collapsed.querySelector("tr.diff-line")).not.toBeNull();
    expect(collapsed.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    await view.cleanup();
  });

  it("counts a file Hide reviewed took off screen and brings it back", async () => {
    diffPrefsStore.actions.set({ hideReviewed: true });
    const view = await mountReviewer([reviewedFile({ file_path: "src/b.ts" })]);
    expect(view.cards()).toHaveLength(1);

    await view.type("answer");
    expect(view.counter()).toBe("1/2");

    await view.click("Next match");

    expect(view.cards()).toHaveLength(2);
    expect(view.cards()[1]?.getAttribute("aria-current")).toBe("true");
    await view.cleanup();
  });

  it("offers no find field and no shortcut hint when the diff has no file", async () => {
    const mounted = await mountWithQuery(
      <ThemeProvider>
        <ReviewWorkbench
          target={{ kind: "pull_request", id: "pr-1" }}
          workspace={{ open: false, issueId: null }}
          diff={{ ...DIFF, files: [], additions: 0, deletions: 0 }}
          review={reviewDetail()}
          notice={null}
        />
      </ThemeProvider>,
    );

    expect(mounted.container.querySelector('input[aria-label="Find in the diff"]')).toBeNull();
    expect(mounted.container.textContent).not.toContain("find");

    await mounted.cleanup();
  });

  it("ignores the find shortcut raised from a dialog over the diff", async () => {
    const view = await mountReviewer();
    await view.type("answer");
    view.field.blur();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    expect(await view.press({ key: "f", metaKey: true }, dialog)).toBe(false);

    expect(document.activeElement).not.toBe(view.field);
    dialog.remove();
    await view.cleanup();
  });

  it("drops its painted names when the reviewer unmounts", async () => {
    const view = await mountReviewer();

    await view.type("answer");
    expect(highlights.size).toBeGreaterThan(0);

    await view.cleanup();

    expect(highlights.size).toBe(0);
  });

  it("never asks the daemon for a file's content", async () => {
    const view = await mountReviewer();

    await view.type("answer");
    await view.click("Next match");

    expect(getDiffFileBlobs).not.toHaveBeenCalled();
    await view.cleanup();
  });
}, 10_000);
