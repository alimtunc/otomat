// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCards } from "@web/components/runs/diff/cards";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import { partitionComments } from "@web/components/runs/review/partition";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fileCommentActions } from "#support/diff-card";
import { stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";
import { stubViewport, type ViewportStub } from "#support/viewport";

stubDiffCanvas();

/** Tailwind writes the `overflow` shorthand; happy-dom only resolves the longhand it is asked for. */
const styles = document.createElement("style");
styles.textContent = ".overflow-auto { overflow-y: auto; }";

const VIEWPORT = 400;
const CARD = 300;
const PATHS = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"];
const FIRST = PATHS[0];
const LAST = PATHS[PATHS.length - 1];
/** Off screen, and near enough that only the slack around the scroll container reaches it. */
const WITHIN_SLACK = PATHS[2];

/** Mirrors the reviewer pane: collapsing, reopening and refetching re-render the same cards. */
function Reviewer() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [, setRound] = useState(0);
  return (
    <div>
      <button type="button" data-testid="collapse" onClick={() => setCollapsed(new Set([FIRST]))}>
        collapse
      </button>
      <button type="button" data-testid="reopen" onClick={() => setCollapsed(new Set())}>
        reopen
      </button>
      <button type="button" data-testid="refetch" onClick={() => setRound((round) => round + 1)}>
        refetch
      </button>
      <ThemeProvider>
        <DiffFileCards
          target={{ kind: "run", id: "run-1" }}
          files={PATHS.map((path) => diffFile({ path, patch: diffPatch(path) }))}
          hiddenCount={0}
          onShowHidden={() => {}}
          prefs={DEFAULT_DIFF_PREFS}
          reviewedPaths={new Set()}
          allReviewed={false}
          unsyncedMarks={new Map()}
          onReviewedChange={() => {}}
          onRetrySync={() => {}}
          collapsed={{ has: (path) => collapsed.has(path), set: () => {} }}
          activePath={null}
          onActivate={() => {}}
          comments={{
            partition: partitionComments(null, []),
            selectedIds: new Set(),
            destinations: { pr_review: false, reason: "This run has no pull request yet." },
            preferredDestination: "agent",
            publishingId: null,
          }}
          commentActions={fileCommentActions()}
        />
      </ThemeProvider>
    </div>
  );
}

function cardsOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("section[aria-label]")];
}

/** The paths whose body carries highlighter output rather than plain text. */
function coloured(container: HTMLElement): string[] {
  return cardsOf(container)
    .filter((card) => card.querySelector(".hljs-keyword") !== null)
    .map((card) => card.getAttribute("aria-label") ?? "");
}

async function click(container: HTMLElement, testId: string): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
  });
}

let viewport: ViewportStub;

beforeEach(() => {
  document.head.append(styles);
  viewport = stubViewport(VIEWPORT);
});

afterEach(() => {
  viewport.restore();
  styles.remove();
});

async function mountReviewer() {
  const mounted = await mountWithQuery(<Reviewer />);
  const scroller = mounted.container.querySelector<HTMLElement>(".overflow-auto");
  if (scroller === null) throw new Error("the cards are not inside a scroll container");
  await act(async () => {
    viewport.layout(cardsOf(mounted.container), CARD);
  });
  return { ...mounted, scroller };
}

describe("diff highlight activation", () => {
  it("observes the container that actually scrolls the cards", async () => {
    const { container, scroller, cleanup } = await mountReviewer();

    expect(getComputedStyle(scroller).overflowY).toBe("auto");
    expect(coloured(container)).toContain(FIRST);
    await cleanup();
  });

  it("leaves the far end of a large diff uncoloured until the reader gets there", async () => {
    const { container, cleanup } = await mountReviewer();

    expect(coloured(container)).not.toContain(LAST);
    await cleanup();
  });

  it("colours a file the reader reaches, without passing over the ones between", async () => {
    const { container, cleanup } = await mountReviewer();

    await act(async () => {
      viewport.scrollTo(CARD * (PATHS.length - 1));
    });

    expect(coloured(container)).toContain(LAST);
    await cleanup();
  });

  it("colours a file reopened after the reader collapsed it", async () => {
    const { container, cleanup } = await mountReviewer();

    await click(container, "collapse");
    expect(coloured(container)).not.toContain(FIRST);
    await click(container, "reopen");

    expect(coloured(container)).toContain(FIRST);
    await cleanup();
  });

  it("keeps the colour across a refetch", async () => {
    const { container, cleanup } = await mountReviewer();

    await click(container, "refetch");

    expect(coloured(container)).toContain(FIRST);
    await cleanup();
  });

  it("keeps the colour when the reader comes back to the view", async () => {
    const first = await mountReviewer();
    expect(coloured(first.container)).toContain(FIRST);
    await first.cleanup();

    const second = await mountReviewer();

    expect(coloured(second.container)).toContain(FIRST);
    await second.cleanup();
  });

  it("recovers the slack when the cards commit before the container scrolls", async () => {
    styles.remove();
    const { container, scroller, cleanup } = await mountReviewer();
    // Bound to the viewport, a card is only reached once it is genuinely on screen.
    expect(coloured(container)).not.toContain(WITHIN_SLACK);

    scroller.style.overflowY = "auto";
    await click(container, "refetch");

    expect(coloured(container)).toContain(WITHIN_SLACK);
    await cleanup();
  });
});
