// @vitest-environment happy-dom
import type { ReviewDetail, ReviewDiffContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { ReviewWorkbench } from "@web/components/runs/diff/review-workbench";
import { writeReviewedFingerprints } from "@web/components/runs/diff/reviewed-files";
import { act, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { domRect, stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";
import { controlScroll, type ScrollControl } from "#support/scroll-control";

stubDiffCanvas();

/** Tailwind writes the `overflow` shorthand; happy-dom only resolves the longhand it is asked for. */
const styles = document.createElement("style");
styles.textContent = ".overflow-auto { overflow-y: auto; }";

const VIEWPORT = 400;
const CARD = 300;
const PATHS = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"];
const TARGET = "src/c.ts";

const DIFF: ReviewDiffContract = {
  base: "base-sha",
  files: PATHS.map((path) => diffFile({ path, patch: diffPatch(path) })),
  additions: 5,
  deletions: 0,
  sha: "diff-sha",
};

const REVIEW: ReviewDetail = {
  review: null,
  comments: [],
  fix_authority: { kind: "review_only", reason: "This pull request is someone else's branch." },
  destinations: { pr_review: false, reason: "This run has no pull request yet." },
};

vi.mock("@web/api/reviews/mutations", () => ({
  useAddReviewComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishReviewComment: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useRequestFix: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@web/components/runs/diff/fix-bar", () => ({ DiffFixBar: () => null }));

vi.mock("@web/components/shell/use-back-navigation", () => ({ useBackNavigation: () => null }));

/** The route owns the selection; this holds it the same way, so the reveal is the code under test. */
vi.mock("@web/components/runs/diff/use-active-file", () => ({
  useActiveDiffFile: () => {
    const [path, setPath] = useState<string | null>(null);
    return { path, select: setPath };
  },
}));

function cardsOf(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("section[aria-label]")];
}

/**
 * Lays the cards out down the scroller and keeps them there: a card mounted by the very render
 * the reveal is waiting for must measure like the browser would, not like an unlaid-out node.
 */
function layoutCards(scroller: HTMLElement, scroll: ScrollControl): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === scroller) return domRect(0, VIEWPORT);
    const index = cardsOf(scroller).findIndex((card) => card === this);
    return index === -1 ? domRect(0, 0) : domRect(index * CARD - scroll.top(), CARD);
  };
}

const original = Element.prototype.getBoundingClientRect;

const wideViewport = window.matchMedia.bind(window);

/** Below the reviewer's wide breakpoint the rail gives way to the file nav. */
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

async function mountReviewer(children?: ReactNode) {
  const mounted = await mountWithQuery(
    <ThemeProvider>
      <ReviewWorkbench
        target={{ kind: "pull_request", id: "pr-1" }}
        workspace={{ open: false, issueId: null }}
        diff={DIFF}
        review={REVIEW}
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
        expect(cardsOf(view.scroller)[2]?.getAttribute("aria-current")).toBe("true");
        await view.cleanup();
      });
    }
  }

  it("waits for a hidden file's card to mount, then scrolls to it once", async () => {
    writeReviewedFingerprints("pr-1", { [TARGET]: `sha-${TARGET}` });
    diffPrefsStore.actions.set({ hideReviewed: true });
    const view = await mountReviewer();
    expect(cardsOf(view.scroller).map((card) => card.getAttribute("aria-label"))).not.toContain(
      TARGET,
    );

    await clickFile(view.container, TARGET);

    expect(cardsOf(view.scroller).map((card) => card.getAttribute("aria-label"))).toContain(TARGET);
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
