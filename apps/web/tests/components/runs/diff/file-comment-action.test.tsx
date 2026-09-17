// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { countFileComments } from "@web/components/runs/review/file-comment-counts";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { diffFileCardProps, fileCommentActions, fileCommentsProp } from "#support/diff-card";
import { MODIFIED_FILE_PATCH, stubDiffCanvas } from "#support/diff-dom";
import { diffFile } from "#support/diff-file";
import { click, setTextareaValue } from "#support/dom-events";
import { findLabelled } from "#support/dom-queries";
import { mountWithQuery } from "#support/mount";
import { reviewComment } from "#support/review-comment";

stubDiffCanvas();

const file = diffFile({ path: "src/index.ts", patch: MODIFIED_FILE_PATCH, sha: "file-sha" });
const WHOLE = reviewComment({
  id: "whole",
  file_path: "src/index.ts",
  diff_sha: "file-sha",
  line: null,
});

describe("file comment action", () => {
  it("opens a whole-file composer from a collapsed file's header and sends no line anchor", async () => {
    const add = vi.fn(async () => {});
    const onCollapsedChange = vi.fn();
    const { container, cleanup } = await mountWithQuery(
      <ThemeProvider>
        <DiffFileCard
          {...diffFileCardProps({
            file,
            collapsed: true,
            onCollapsedChange,
            commentActions: fileCommentActions({ add }),
          })}
        />
      </ThemeProvider>,
    );
    expect(container.querySelector("textarea")).toBeNull();

    await act(async () => {
      findLabelled("Add file comment on src/index.ts")?.click();
    });

    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(container.textContent).toContain("src/index.ts · whole file, no line targeted");
    const field = findLabelled("Review comment");
    if (!(field instanceof HTMLTextAreaElement)) throw new Error("no composer rendered");
    await act(async () => {
      setTextareaValue(field, "Split this module.");
    });
    await click("Add comment");

    expect(add).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ line: null, start_line: null, destination: "agent" }),
    );
    await cleanup();
  });

  it("shows a whole-file comment on its collapsed file and counts it", async () => {
    const { container, cleanup } = await mountWithQuery(
      <ThemeProvider>
        <DiffFileCard
          {...diffFileCardProps({
            file,
            collapsed: true,
            comments: fileCommentsProp({
              whole: [WHOLE],
              all: [WHOLE],
              counts: countFileComments([WHOLE], new Set(["whole"])),
              anchoredIds: new Set(["whole"]),
            }),
          })}
        />
      </ThemeProvider>,
    );

    expect(container.querySelector("#review-comment-whole")?.textContent).toContain(
      "src/index.ts · whole file",
    );
    expect(findLabelled("1 comment on src/index.ts, 1 open")).toBeDefined();
    await cleanup();
  });
});
