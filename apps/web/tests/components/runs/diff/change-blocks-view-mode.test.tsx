// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { changeBlockRows } from "@web/components/runs/diff/diff-nav";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { diffFileDomId } from "@web/components/runs/diff/files/card.utils";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import { describe, expect, it } from "vitest";

import { diffFileCardProps } from "#support/diff-card";
import { stubDiffCanvas } from "#support/diff-dom";
import { diffFile } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

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

const file = diffFile({
  path: "src/index.ts",
  deletions: 2,
  patch: TWO_CHANGE_PATCH,
  sha: "file-sha",
});

function renderCard(mode: "unified" | "split") {
  return mountWithQuery(
    <ThemeProvider>
      <DiffFileCard {...diffFileCardProps({ file, prefs: { ...DEFAULT_DIFF_PREFS, mode } })} />
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
