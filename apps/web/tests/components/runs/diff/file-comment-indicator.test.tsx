// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { countFileComments } from "@web/components/runs/review/file-comment-counts";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { diffFileCardProps, fileCommentsProp } from "#support/diff-card";
import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { diffFile } from "#support/diff-file";
import { findLabelled } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { reviewComment } from "#support/review-comment";

stubDiffCanvas();

const file = diffFile({ path: "src/index.ts", patch: MODIFIED_FILE_PATCH, sha: "file-sha" });

const COMMENTS = [
  reviewComment({ id: "open-agent", file_path: "src/index.ts" }),
  reviewComment({ id: "done", file_path: "src/index.ts", status: "addressed" }),
  reviewComment({
    id: "on-pr",
    file_path: "src/index.ts",
    destination: "pr_review",
    publication_status: "published",
  }),
];

function renderCard(overrides: Parameters<typeof fileCommentsProp>[0] = {}, reveal = vi.fn()) {
  return mountWithQuery(
    <ThemeProvider>
      <DiffFileCard
        {...diffFileCardProps({
          file,
          comments: fileCommentsProp({
            all: COMMENTS,
            counts: countFileComments(COMMENTS, new Set(["open-agent"])),
            anchoredIds: new Set(["open-agent"]),
            ...overrides,
          }),
          commentActions: { add: async () => {}, reveal },
        })}
      />
    </ThemeProvider>,
  );
}

describe("file header comment indicator", () => {
  it("counts the open comments and names the file's feedback for a screen reader", async () => {
    const { cleanup } = await renderCard();

    const indicator = findLabelled(
      "3 comments on src/index.ts, 2 open, 1 on the pull request review, 1 stale",
    );
    expect(indicator?.textContent?.trim()).toBe("2");
    await cleanup();
  });

  it("stays visible, dimmed, once every comment is addressed", async () => {
    const addressed = COMMENTS.map((comment) => ({ ...comment, status: "addressed" }) as const);
    const { cleanup } = await renderCard({
      all: addressed,
      counts: countFileComments(addressed, new Set()),
    });

    const indicator = findLabelled(
      "3 comments on src/index.ts, all addressed, 1 on the pull request review",
    );
    expect(indicator?.textContent?.trim()).toBe("3");
    await cleanup();
  });

  it("stays present while the file's body is collapsed", async () => {
    const { container, cleanup } = await renderCard();

    expect(container.querySelector(".diff-view-wrapper")).not.toBeNull();
    await cleanup();

    const collapsed = await mountWithQuery(
      <ThemeProvider>
        <DiffFileCard
          {...diffFileCardProps({
            file,
            collapsed: true,
            comments: fileCommentsProp({
              all: COMMENTS,
              counts: countFileComments(COMMENTS, new Set(["open-agent"])),
              anchoredIds: new Set(["open-agent"]),
            }),
          })}
        />
      </ThemeProvider>,
    );
    expect(collapsed.container.querySelector(".diff-view-wrapper")).toBeNull();
    expect(
      findLabelled("3 comments on src/index.ts, 2 open, 1 on the pull request review, 1 stale"),
    ).toBeDefined();
    await collapsed.cleanup();
  });

  it("navigates to a file's comments from the indicator", async () => {
    const reveal = vi.fn();
    const { cleanup } = await renderCard({}, reveal);

    await act(async () => {
      findLabelled(
        "3 comments on src/index.ts, 2 open, 1 on the pull request review, 1 stale",
      )?.click();
    });
    await act(async () => {
      findLabelled("Next comment on src/index.ts")?.click();
    });

    expect(reveal).toHaveBeenLastCalledWith(COMMENTS[0]);

    await act(async () => {
      findLabelled("Next comment on src/index.ts")?.click();
    });

    expect(reveal).toHaveBeenLastCalledWith(COMMENTS[1]);
    await cleanup();
  });

  it("renders nothing for a file with no feedback at all", async () => {
    const { cleanup } = await renderCard({ all: [], counts: countFileComments([], new Set()) });

    expect(findLabelled("0 comments on src/index.ts, all addressed")).toBeUndefined();
    await cleanup();
  });
});
