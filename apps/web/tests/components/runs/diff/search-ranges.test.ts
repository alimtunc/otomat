// @vitest-environment happy-dom
import { rangesAtOffsets } from "@web/components/runs/diff/search/ranges";
import { describe, expect, it } from "vitest";

/** Syntax highlighting is what splits one word across sibling spans, as it does here. */
function element(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

function spans(range: Range): [string, number, number] {
  return [range.toString(), range.startOffset, range.endOffset];
}

function resolved(root: HTMLElement, offsets: readonly number[], length: number): Range[] {
  return rangesAtOffsets(root, offsets, length).filter((range) => range !== null);
}

describe("projecting hunk offsets over an element's text nodes", () => {
  it("spans a word the markup split across siblings", () => {
    const root = element("<span>ans</span><span>wer</span> = 42");

    const [range, ...rest] = resolved(root, [0], "answer".length);

    expect(rest).toEqual([]);
    expect(range?.toString()).toBe("answer");
    expect(range?.startContainer.textContent).toBe("ans");
    expect(range?.endContainer.textContent).toBe("wer");
  });

  it("returns one range per occurrence, at its own offset", () => {
    const root = element("const answer = answer + 1;");

    expect(resolved(root, [6, 15], "answer".length).map(spans)).toEqual([
      ["answer", 6, 12],
      ["answer", 15, 21],
    ]);
  });

  it("preserves the caller's offset order", () => {
    const root = element("const answer = answer + 1;");

    expect(resolved(root, [15, 6], "answer".length).map(spans)).toEqual([
      ["answer", 15, 21],
      ["answer", 6, 12],
    ]);
  });

  it("keeps an indexed offset aligned past a multibyte character", () => {
    const root = element("İ answer");

    expect(resolved(root, [2], "answer".length).map(spans)).toEqual([["answer", 2, 8]]);
  });

  it("returns null for an offset the rendered line cannot represent", () => {
    const root = element("const answer = 42;");

    expect(rangesAtOffsets(root, [100], "answer".length)).toEqual([null]);
  });

  it("does no work for an empty match", () => {
    const root = element("const answer = 42;");

    expect(rangesAtOffsets(root, [0], 0)).toEqual([]);
  });
});
