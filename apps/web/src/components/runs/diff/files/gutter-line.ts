import type { DiffSide } from "@otomat/domain";

const GUTTER_CELLS = ".diff-line-num, .diff-line-old-num, .diff-line-new-num";

function lineIn(cell: Element, attribute: string): number | null {
  const raw = cell.querySelector(`span[${attribute}]`)?.getAttribute(attribute);
  const line = Number(raw);
  return raw != null && Number.isInteger(line) && line > 0 ? line : null;
}

/** A unified gutter cell carries both line numbers, a split one only its own side's. */
export function gutterLine(target: EventTarget | null): { side: DiffSide; line: number } | null {
  const cell = target instanceof Element ? target.closest(GUTTER_CELLS) : null;
  if (cell === null) return null;
  if (cell.classList.contains("diff-line-old-num")) {
    const line = lineIn(cell, "data-line-num");
    return line === null ? null : { side: "old", line };
  }
  if (cell.classList.contains("diff-line-new-num")) {
    const line = lineIn(cell, "data-line-num");
    return line === null ? null : { side: "new", line };
  }
  const head = lineIn(cell, "data-line-new-num");
  if (head !== null) return { side: "new", line: head };
  const base = lineIn(cell, "data-line-old-num");
  return base === null ? null : { side: "old", line: base };
}
