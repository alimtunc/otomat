// @vitest-environment happy-dom
import type { ReviewedFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { ReviewWorkbench } from "@web/components/runs/diff/review-workbench";
import { act, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { diffCardsOf, domRect, overflowLonghandStyle, stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch, reviewDiff } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";
import { reviewDetail } from "#support/review-detail";
import { reviewedFile } from "#support/reviewed-file";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

stubDiffCanvas();

const styles = overflowLonghandStyle();

const VIEWPORT = 400;
const CARD = 300;
const PATHS = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"];
const TARGET = "src/c.ts";

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

vi.mock("@web/components/runs/diff/use-active-file", () => ({
  useActiveDiffFile: () => {
    const [path, setPath] = useState<string | null>(null);
    return { path, select: setPath };
  },
}));

/** A card mounted by the very render the reveal waits for must measure like the browser would, not like an unlaid-out node. */
function layoutCards(scroller: HTMLElement, scroll: ScrollControl): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === scroller) return domRect(0, VIEWPORT);
    const index = diffCardsOf(scroller).findIndex((card) => card === this);
    return index === -1 ? domRect(0, 0) : domRect(index * CARD - scroll.top(), CARD);
  };
}

const original = Element.prototype.getBoundingClientRect;

const wideViewport = window.matchMedia.bind(window);

function narrowViewport(): void {
  window.matchMedia = () => wideViewport("(min-width: 99999px)");
}

beforeEach(() => {
  document.head.append(styles);
  window.localStorage.clear();
  diffPrefsStore.actions.set({ browser: "files", hideReviewed: false, mode: "unified" });
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = original;
  window.matchMedia = wideViewport;
  styles.remove();
});

async function mountReviewer(children?: ReactNode, reviewedFiles: ReviewedFileContract[] = []) {
  const mounted = await mountWithQuery(
    <ThemeProvider>
      <ReviewWorkbench
        target={{ kind: "pull_request", id: "pr-1" }}
        workspace={{ open: false, issueId: null }}
        diff={DIFF}
        review={reviewDetail(reviewedFiles)}
        notice={children ?? null}
      />
    </ThemeProvider>,
  );
  // The rail scrolls too, so the container under test is the one the cards themselves sit in.
  const scroller = mounted.container
    .querySelector<HTMLElement>("section[aria-label]")
    ?.closest<HTMLElement>(".overflow-auto");
  if (scroller === null || scroller === undefined) {
    throw new Error("the cards are not inside a scroll container");
  }
  const scroll = controlScroll(scroller, VIEWPORT, PATHS.length * CARD + VIEWPORT);
  layoutCards(scroller, scroll);
  return { ...mounted, scroller, scroll };
}

async function clickFile(container: HTMLElement, path: string): Promise<void> {
  const row = [...container.querySelectorAll<HTMLElement>('nav[aria-label="Changed files"] button')]
    .filter((button) => (button.getAttribute("title") ?? "").includes(path))
    .at(0);
  if (row === undefined) throw new Error(`no rail row for ${path}`);
  await act(async () => {
    row.click();
  });
}

describe("revealing a file from the rail", () => {
  for (const browser of ["files", "tree"] as const) {
    for (const mode of ["unified", "split"] as const) {
      it(`puts its card at the top of the diff container in ${browser}/${mode}`, async () => {
        diffPrefsStore.actions.set({ browser, mode });
        const view = await mountReviewer();

        await clickFile(view.container, TARGET);

        expect(view.scroll.top()).toBe(2 * CARD);
        expect(diffCardsOf(view.scroller)[2]?.getAttribute("aria-current")).toBe("true");
        await view.cleanup();
      });
    }
  }

  it("waits for a hidden file's card to mount, then scrolls to it once", async () => {
    diffPrefsStore.actions.set({ hideReviewed: true });
    const view = await mountReviewer(null, [reviewedFile({ file_path: TARGET })]);
    expect(diffCardsOf(view.scroller).map((card) => card.getAttribute("aria-label"))).not.toContain(
      TARGET,
    );

    await clickFile(view.container, TARGET);

    expect(diffCardsOf(view.scroller).map((card) => card.getAttribute("aria-label"))).toContain(
      TARGET,
    );
    expect(view.scroll.top()).toBe(2 * CARD);
    await view.cleanup();
  });

  it("reveals the same way from the narrow-viewport file nav", async () => {
    narrowViewport();
    const view = await mountReviewer();
    const next = view.container.querySelector<HTMLElement>('[aria-label="Next file"]');
    if (next === null) throw new Error("the narrow viewport shows no file nav");

    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        next.click();
      });
    }

    expect(view.scroll.top()).toBe(2 * CARD);
    await view.cleanup();
  });

  it("scrolls without taking the focus from a comment being written", async () => {
    const view = await mountReviewer();
    const composing = document.createElement("textarea");
    view.container.append(composing);
    composing.focus();

    await clickFile(view.container, TARGET);

    expect(view.scroll.top()).toBe(2 * CARD);
    expect(document.activeElement).toBe(composing);
    await view.cleanup();
  });
});
