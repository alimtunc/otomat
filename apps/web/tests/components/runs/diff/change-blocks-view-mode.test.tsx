// @vitest-environment happy-dom
import type { DiffFileContract } from "@otomat/domain";
import { ThemeProvider } from "@otomat/ui";
import { changeBlockRows } from "@web/components/runs/diff/diff-nav";
import { DiffFileCard } from "@web/components/runs/diff/file-card";
import { diffFileDomId } from "@web/components/runs/diff/file-card.utils";
import { describe, expect, it } from "vitest";

import { stubDiffCanvas } from "#support/diff-dom";
import { mount } from "#support/mount";

stubDiffCanvas();

/** One modification (old line 2) and one pure deletion (old line 7): two logical changes. */
const TWO_CHANGE_PATCH = `diff --git a/src/index.ts b/src/index.ts
index 0000001..0000002 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,5 @@
 line one
-line two
+line two changed
 line three
 line four
 line five
@@ -10,4 +10,3 @@
 line ten
-line eleven
 line twelve
`;

const file: DiffFileContract = {
  path: "src/index.ts",
  old_path: null,
  status: "modified",
  additions: 1,
  deletions: 2,
  binary: false,
  patch: TWO_CHANGE_PATCH,
  sha: "file-sha",
};

function renderCard(mode: "unified" | "split") {
  return mount(
    <ThemeProvider>
      <DiffFileCard
        file={file}
        mode={mode}
        reviewed={false}
        onReviewedChange={() => {}}
        commentsByLine={new Map()}
        onAddComment={async () => {}}
        selectedCommentIds={new Set()}
        onToggleComment={() => {}}
      />
    </ThemeProvider>,
  );
}

describe("changeBlockRows over a rendered diff card", () => {
  for (const mode of ["unified", "split"] as const) {
    it(`anchors each change once in ${mode} mode`, async () => {
      const { container, cleanup } = await renderCard(mode);
      const card = container.querySelector<HTMLElement>(`#${CSS.escape(diffFileDomId(file))}`);
      if (card === null) throw new Error("no diff file card rendered");

      const lines = changeBlockRows(card).map((row) => row.getAttribute("data-line"));

      expect(lines).toEqual(mode === "unified" ? ["2", "8"] : ["2", "7"]);
      await cleanup();
    });
  }
});
