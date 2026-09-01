// @vitest-environment happy-dom
import type { ReviewedFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { ReviewWorkbench } from "@web/components/runs/diff/review-workbench";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diffCardsOf, domRect, overflowLonghandStyle, stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch, reviewDiff } from "#support/diff-file";
import { reviewDetail } from "#support/review-detail";
import { reviewedFile } from "#support/reviewed-file";
import { mountRoutedWithQuery } from "#support/router";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

stubDiffCanvas();

const styles = overflowLonghandStyle();

const VIEWPORT = 400;
const EXPANDED = 300;
const FOLDED = 34;
const PATHS = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"];
const READING = "src/c.ts";
const NEXT = "src/d.ts";

const DIFF = reviewDiff({
  files: PATHS.map((path) => diffFile({ path, patch: diffPatch(path) })),
  additions: 5,
});

vi.mock("@web/api/reviews/mutations", () => ({
  useAddReviewComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishReviewComment: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRequestFix: () => ({ mutate: vi.fn(), isPending: false }),
  useSetReviewedFile: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

vi.mock("@web/components/runs/diff/fix-bar", () => ({ DiffFixBar: () => null }));

vi.mock("@web/components/shell/use-back-navigation", () => ({ useBackNavigation: () => null }));

function folded(card: HTMLElement): boolean {
  return card.querySelector(`[aria-label="Expand ${card.getAttribute("aria-label")}"]`) !== null;
}

/** Folding the file being reviewed lifts every card under it, so a reveal that measures before that leaves the reader mid-file. */
function layoutCards(scroller: HTMLElement, scroll: ScrollControl): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === scroller) return domRect(0, VIEWPORT);
    let top = 0;
    for (const card of diffCardsOf(scroller)) {
      const height = folded(card) ? FOLDED : EXPANDED;
      if (card === this) return domRect(top - scroll.top(), height);
      top += height;
    }
    return domRect(0, 0);
  };
}

const original = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  document.head.append(styles);
  window.localStorage.clear();
  diffPrefsStore.actions.set({ browser: "files", hideReviewed: false, mode: "unified" });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = original;
  styles.remove();
});

/** The router lands the selection on a macrotask; `act` drains the renders that follow it. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountReviewer(reviewedFiles: ReviewedFileContract[] = []) {
  const mounted = await mountRoutedWithQuery(
    <ThemeProvider>
      <ReviewWorkbench
        target={{ kind: "pull_request", id: "pr-1" }}
        workspace={{ open: false, issueId: null }}
        answered={{ kind: "pull_request", number: 1 }}
        diff={DIFF}
        review={reviewDetail(reviewedFiles)}
        notice={null}
      />
    </ThemeProvider>,
  );
  const scroller = diffCardsOf(mounted.container).at(0)?.closest<HTMLElement>(".overflow-auto");
  if (scroller === null || scroller === undefined) {
    throw new Error("the cards are not inside a scroll container");
  }
  const scroll = controlScroll(scroller, VIEWPORT, PATHS.length * EXPANDED + VIEWPORT);
  layoutCards(scroller, scroll);
  return { ...mounted, scroller, scroll };
}

function cardFor(scroller: HTMLElement, path: string): HTMLElement {
  const card = diffCardsOf(scroller).find((entry) => entry.getAttribute("aria-label") === path);
  if (card === undefined) throw new Error(`no card for ${path}`);
  return card;
}

async function readMidwayThrough(scroller: HTMLElement, scroll: ScrollControl, path: string) {
  const card = cardFor(scroller, path);
  scroll.dragTo(scroll.top() + card.getBoundingClientRect().top + EXPANDED / 2);
  await act(async () => {
    card.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }));
  });
  await settle();
}

async function markReviewed(scroller: HTMLElement, path: string): Promise<void> {
  const checkbox = cardFor(scroller, path).querySelector<HTMLElement>('input[type="checkbox"]');
  if (checkbox === null) throw new Error(`no Reviewed control on ${path}`);
  await act(async () => {
    checkbox.click();
  });
  await settle();
}

async function pressReviewedShortcut(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "v", bubbles: true }));
  });
  await settle();
}

function revealed(scroller: HTMLElement) {
  const card = diffCardsOf(scroller).find((entry) => entry.getAttribute("aria-current") === "true");
  return {
    path: card?.getAttribute("aria-label") ?? null,
    top: card?.getBoundingClientRect().top ?? null,
  };
}

describe("advancing to the next file to review", () => {
  for (const hideReviewed of [false, true]) {
    it(`starts the next file at its header when the mouse marks one (hidden: ${hideReviewed})`, async () => {
      diffPrefsStore.actions.set({ hideReviewed });
      const view = await mountReviewer();
      await readMidwayThrough(view.scroller, view.scroll, READING);

      await markReviewed(view.scroller, READING);

      expect(revealed(view.scroller)).toEqual({ path: NEXT, top: 0 });
      await view.cleanup();
    });

    it(`starts the next file at its header when the keyboard marks one (hidden: ${hideReviewed})`, async () => {
      diffPrefsStore.actions.set({ hideReviewed });
      const view = await mountReviewer();
      await readMidwayThrough(view.scroller, view.scroll, READING);

      await pressReviewedShortcut();

      expect(revealed(view.scroller)).toEqual({ path: NEXT, top: 0 });
      await view.cleanup();
    });
  }

  it("leaves the reader where they are when no file is left to review", async () => {
    const others = PATHS.filter((path) => path !== READING).map((path) =>
      reviewedFile({ file_path: path }),
    );
    const view = await mountReviewer(others);
    await readMidwayThrough(view.scroller, view.scroll, READING);
    const resting = view.scroll.top();

    await markReviewed(view.scroller, READING);

    expect(revealed(view.scroller).path).toBe(READING);
    expect(view.scroll.top()).toBe(resting);
    await view.cleanup();
  });
});
