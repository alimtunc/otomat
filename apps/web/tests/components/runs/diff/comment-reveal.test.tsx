// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { diffPrefsStore } from "@web/components/runs/diff/prefs/store";
import { ReviewWorkbench } from "@web/components/runs/diff/review-workbench";
import { act, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { diffCardsOf, stubDiffCanvas } from "#support/diff-dom";
import { diffFile, diffPatch, reviewDiff } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";
import { reviewComment } from "#support/review-comment";
import { reviewDetail } from "#support/review-detail";

stubDiffCanvas();

vi.mock("@web/api/reviews/mutations", () => ({
  useAddReviewComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

const PATHS = ["src/a.ts", "src/b.ts", "src/c.ts"];
const DIFF = reviewDiff({
  files: PATHS.map((path) => diffFile({ path, patch: diffPatch(path) })),
});
const ON_C = reviewComment({
  id: "whole",
  file_path: "src/c.ts",
  diff_sha: "sha-src/c.ts",
  line: null,
});

beforeEach(() => {
  window.localStorage.clear();
  diffPrefsStore.actions.set({ browser: "files", hideReviewed: false, mode: "unified" });
});

describe("navigating to a whole-file comment", () => {
  it("selects the file and lands on the comment card without a line anchor", async () => {
    const { container, cleanup } = await mountWithQuery(
      <ThemeProvider>
        <ReviewWorkbench
          target={{ kind: "run", id: "run-1" }}
          workspace={{ open: true, issueId: null }}
          answered={{ kind: "branch", branch: "feature", base_ref: "main" }}
          diff={DIFF}
          review={reviewDetail([], { comments: [ON_C] })}
          notice={null}
        />
      </ThemeProvider>,
    );

    const commentsTab = [
      ...container.querySelectorAll<HTMLButtonElement>('[aria-label="Reviewer rail"] button'),
    ].find((button) => button.textContent?.startsWith("Comments"));
    if (commentsTab === undefined) throw new Error("no Comments tab in the rail");
    await act(async () => {
      commentsTab.click();
    });
    const row = container.querySelector<HTMLButtonElement>('button[title="src/c.ts · whole file"]');
    if (row === null) throw new Error("no comment row for src/c.ts");
    await act(async () => {
      row.click();
    });

    const card = diffCardsOf(container).find(
      (section) => section.getAttribute("aria-label") === "src/c.ts",
    );
    expect(card?.getAttribute("aria-current")).toBe("true");
    expect(document.activeElement?.id).toBe("review-comment-whole");
    await cleanup();
  });
});
