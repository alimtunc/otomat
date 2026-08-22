// @vitest-environment happy-dom
import { ThemeProvider } from "@otomat/ui";
import { DiffFileCard } from "@web/components/runs/diff/files/card";
import { DEFAULT_DIFF_PREFS } from "@web/components/runs/diff/prefs/prefs";
import { paintDiffSearch } from "@web/components/runs/diff/search/highlight";
import type { DiffSearchMatch } from "@web/components/runs/diff/search/matches";
import { beforeEach, describe, expect, it } from "vitest";

import { diffFileCardProps } from "#support/diff-card";
import { stubDiffCanvas, stubHighlightApi } from "#support/diff-dom";
import { diffFile, diffPatch } from "#support/diff-file";
import { mountWithQuery } from "#support/mount";

stubDiffCanvas();

const highlights = stubHighlightApi();

const PATH = "src/index.ts";
const file = diffFile({ path: PATH, patch: diffPatch(PATH) });

const TWICE = "src/twice.ts";
/** One rendered line carrying the needle twice, which no other fixture patch does. */
const twice = diffFile({
  path: TWICE,
  patch: `diff --git a/${TWICE} b/${TWICE}
index 0000001..0000002 100644
--- a/${TWICE}
+++ b/${TWICE}
@@ -1 +1 @@
-let value = 1;
+const answer = answer + 1;
`,
});

const ADDED: DiffSearchMatch = { path: PATH, oldLine: null, newLine: 2, offset: 6 };
const REMOVED: DiffSearchMatch = { path: PATH, oldLine: 2, newLine: null, offset: 0 };
const CONTEXT: DiffSearchMatch = { path: PATH, oldLine: 1, newLine: 1, offset: 6 };
const FIRST: DiffSearchMatch = { path: TWICE, oldLine: null, newLine: 1, offset: 6 };
const SECOND: DiffSearchMatch = { path: TWICE, oldLine: null, newLine: 1, offset: 15 };

function renderCard(mode: "unified" | "split", wrap: boolean, collapsed = false, on = file) {
  return mountWithQuery(
    <ThemeProvider>
      <DiffFileCard
        {...diffFileCardProps({
          file: on,
          collapsed,
          prefs: { ...DEFAULT_DIFF_PREFS, mode, wrap },
        })}
      />
    </ThemeProvider>,
  );
}

function painted(name: string): Range[] {
  return [...(highlights.get(name) ?? [])];
}

function at(range: Range): [string, Node, number] {
  return [range.toString(), range.startContainer, range.startOffset];
}

beforeEach(() => {
  highlights.clear();
});

describe("resolving a match to the line @git-diff-view rendered", () => {
  it("leaves the rest of the CSS namespace the other test support relies on", () => {
    expect(CSS.escape("a.b")).toBe("a\\.b");
  });

  for (const mode of ["unified", "split"] as const) {
    for (const wrap of [false, true]) {
      it(`points at the added line's own text in ${mode}, wrap ${wrap}`, async () => {
        const { cleanup } = await renderCard(mode, wrap);

        const element = paintDiffSearch("answer", [ADDED], 0);

        expect(element?.textContent).toBe("const answer = 42;");
        await cleanup();
      });

      it(`points at the removed line's own text in ${mode}, wrap ${wrap}`, async () => {
        const { cleanup } = await renderCard(mode, wrap);

        const element = paintDiffSearch("second", [REMOVED], 0);

        expect(element?.textContent).toBe("second line");
        await cleanup();
      });

      it(`paints the match once in ${mode}, wrap ${wrap}`, async () => {
        const { cleanup } = await renderCard(mode, wrap);

        paintDiffSearch("answer", [ADDED], 0);

        expect(painted("otomat-diff-search").map((range) => range.toString())).toEqual(["answer"]);
        expect(painted("otomat-diff-search-active").map((range) => range.toString())).toEqual([
          "answer",
        ]);
        await cleanup();
      });
    }
  }

  it("paints a context line once although both sides number it", async () => {
    const { cleanup } = await renderCard("unified", false);

    paintDiffSearch("line", [CONTEXT], 0);

    expect(painted("otomat-diff-search")).toHaveLength(1);
    await cleanup();
  });

  it("distinguishes two occurrences of the needle on one line", async () => {
    const { cleanup } = await renderCard("unified", false, false, twice);

    paintDiffSearch("answer", [FIRST, SECOND], 0);
    const first = painted("otomat-diff-search-active").map(at);
    paintDiffSearch("answer", [FIRST, SECOND], 1);
    const second = painted("otomat-diff-search-active").map(at);

    expect(painted("otomat-diff-search")).toHaveLength(2);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first).not.toEqual(second);
    await cleanup();
  });

  it("pairs a range with the match's own rank, whatever the match order", async () => {
    const { cleanup } = await renderCard("unified", false, false, twice);

    paintDiffSearch("answer", [FIRST, SECOND], 1);
    const second = painted("otomat-diff-search-active").map(at);
    paintDiffSearch("answer", [SECOND, FIRST], 0);

    expect(painted("otomat-diff-search-active").map(at)).toEqual(second);
    await cleanup();
  });

  it("clears the painted names once nothing matches", async () => {
    const { cleanup } = await renderCard("unified", false);

    paintDiffSearch("answer", [ADDED], 0);
    paintDiffSearch("", [], -1);

    expect(highlights.has("otomat-diff-search")).toBe(false);
    expect(highlights.has("otomat-diff-search-active")).toBe(false);
    await cleanup();
  });

  it("resolves nothing while the file's body is collapsed", async () => {
    const { cleanup } = await renderCard("unified", false, true);

    expect(paintDiffSearch("answer", [ADDED], 0)).toBeNull();
    await cleanup();
  });

  it("resolves nothing for a match that is not the active one", async () => {
    const { cleanup } = await renderCard("unified", false);

    expect(paintDiffSearch("answer", [ADDED], -1)).toBeNull();
    expect(painted("otomat-diff-search-active")).toEqual([]);
    expect(painted("otomat-diff-search")).toHaveLength(1);
    await cleanup();
  });
});
