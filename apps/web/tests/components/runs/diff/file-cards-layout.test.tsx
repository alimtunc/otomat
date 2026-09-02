// @vitest-environment happy-dom
import { BRANCH_DIFF_SCOPE } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCards, type DiffFileCardsProps } from "@web/components/runs/diff/cards";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import { partitionComments } from "@web/components/runs/review/partition";
import { afterEach, describe, expect, it } from "vitest";

import { fileCommentActions } from "#support/diff-card";
import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { diffFile, reviewDiff } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

const FILES = [
  diffFile({ path: "a.ts", patch: MODIFIED_FILE_PATCH }),
  diffFile({ path: "b.ts", patch: MODIFIED_FILE_PATCH }),
];

const SPACING_UTILITY = /(?:^|\s)-?[mp][xytrbles]?-/;

function cardsProps(overrides: Partial<DiffFileCardsProps> = {}): DiffFileCardsProps {
  return {
    target: { kind: "run", id: "run-1" },
    scope: BRANCH_DIFF_SCOPE,
    files: FILES,
    hiddenCount: 0,
    onShowHidden: () => {},
    prefs: DEFAULT_DIFF_PREFS,
    reviewedPaths: new Set(),
    allReviewed: false,
    unsyncedMarks: new Map(),
    onReviewedChange: () => {},
    onRetrySync: () => {},
    collapsed: { has: () => false, set: () => {} },
    activePath: null,
    onActivate: () => {},
    comments: {
      partition: partitionComments(reviewDiff({ files: FILES }), []),
      destinations: { pr_review: false, reason: "This run has no pull request yet." },
      preferredDestination: "agent",
    },
    commentActions: fileCommentActions(),
    ...overrides,
  };
}

const cleanups: Array<() => Promise<void>> = [];

async function renderCards(overrides: Partial<DiffFileCardsProps> = {}) {
  const { container, cleanup } = await mountWithQuery(
    <ThemeProvider>
      <DiffFileCards {...cardsProps(overrides)} />
    </ThemeProvider>,
  );
  cleanups.push(cleanup);
  const scroller = container.querySelector<HTMLElement>("div.overflow-auto");
  if (scroller === null) throw new Error("no scrolling region rendered");
  return { container, scroller };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe("diff file cards layout", () => {
  it("stacks the cards straight onto the panel, with no gutter of its own", async () => {
    const { scroller } = await renderCards();

    expect(scroller.className).not.toMatch(SPACING_UTILITY);
    const sections = [...scroller.children].filter((child) => child.tagName === "SECTION");
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual(["a.ts", "b.ts"]);
  });

  it("says the queue is done once every file is reviewed", async () => {
    const { container } = await renderCards({
      reviewedPaths: new Set(["a.ts", "b.ts"]),
      allReviewed: true,
    });

    expect(container.textContent).toContain("All files reviewed");
    expect(container.textContent).toContain("2 changed files are marked Reviewed");
  });

  it("says nothing about the queue while a file is still unread", async () => {
    const { container } = await renderCards({ reviewedPaths: new Set(["a.ts"]) });

    expect(container.textContent).not.toContain("All files reviewed");
  });
});
