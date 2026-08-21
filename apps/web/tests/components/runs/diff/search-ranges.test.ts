// @vitest-environment happy-dom
import { occurrenceRanges } from "@web/components/runs/diff/search/ranges";
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

describe("resolving a needle to ranges over an element's text nodes", () => {
  it("spans a word the markup split across siblings", () => {
    const root = element("<span>ans</span><span>wer</span> = 42");

    const [range, ...rest] = occurrenceRanges(root, "answer");

    expect(rest).toEqual([]);
    expect(range?.toString()).toBe("answer");
    expect(range?.startContainer.textContent).toBe("ans");
    expect(range?.endContainer.textContent).toBe("wer");
  });

  it("returns one range per occurrence, at its own offset", () => {
    const root = element("const answer = answer + 1;");

    expect(occurrenceRanges(root, "answer").map(spans)).toEqual([
      ["answer", 6, 12],
      ["answer", 15, 21],
    ]);
  });

  it("matches case-insensitively without shifting the offsets it reports", () => {
    const root = element("const Answer = answer;");

    expect(occurrenceRanges(root, "ANSWER").map(spans)).toEqual([
      ["Answer", 6, 12],
      ["answer", 15, 21],
    ]);
  });

  it("keeps offsets aligned past a character whose lowercase is longer", () => {
    const root = element("İ answer");

    expect(occurrenceRanges(root, "answer").map(spans)).toEqual([["answer", 2, 8]]);
  });

  it("treats the needle literally, with no regex meaning", () => {
    const root = element("const answer = 42;");

    expect(occurrenceRanges(root, "answer.")).toEqual([]);
    expect(occurrenceRanges(root, "an.wer")).toEqual([]);
  });

  it("terminates on an empty needle instead of matching every position", () => {
    const root = element("const answer = 42;");

    expect(occurrenceRanges(root, "")).toEqual([]);
  });
});
