import { DIFF_SIDES, type DiffSide } from "@otomat/domain";
import type { DiffSearchMatch } from "@web/components/runs/diff/search/matches";

/** @git-diff-view puts a line's text in one of these, syntax highlighting on or off. */
const TEXT_SELECTOR = ".diff-line-content-raw, .diff-line-syntax-raw";

function sideCells(card: HTMLElement, side: DiffSide, line: number): HTMLElement[] {
  const cells: HTMLElement[] = [];
  for (const marker of card.querySelectorAll<HTMLElement>(`[data-line-${side}-num="${line}"]`)) {
    const cell = marker.closest("tr")?.querySelector<HTMLElement>("td.diff-line-content");
    if (cell != null) cells.push(cell);
  }
  for (const marker of card.querySelectorAll<HTMLElement>(`span[data-line-num="${line}"]`)) {
    if (marker.closest<HTMLElement>("[data-side]")?.dataset["side"] !== side) continue;
    const cell = marker.closest("tr")?.querySelector<HTMLElement>(`td.diff-line-${side}-content`);
    if (cell != null) cells.push(cell);
  }
  return cells;
}

/** Keyed on the printed number: an expanded hunk inserts rows the patch never held. */
export function lineTextElements(
  card: HTMLElement,
  line: Pick<DiffSearchMatch, "oldLine" | "newLine">,
): HTMLElement[] {
  // Unified prints both numbers in one cell, so the two sides resolve the same element.
  const cells = new Set<HTMLElement>();
  for (const side of DIFF_SIDES) {
    const number = side === "new" ? line.newLine : line.oldLine;
    if (number === null) continue;
    for (const cell of sideCells(card, side, number)) cells.add(cell);
  }
  return [...cells].flatMap((cell) => [...cell.querySelectorAll<HTMLElement>(TEXT_SELECTOR)]);
}
