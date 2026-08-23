import type { DiffFileContract } from "@otomat/domain";
import { isEditableTarget } from "@otomat/ui";
import { scrollIntoContainer, type RevealBlock } from "@web/components/runs/diff/scroll";

export function adjacentFile(
  files: readonly DiffFileContract[],
  activePath: string | null,
  direction: 1 | -1,
): DiffFileContract | null {
  if (files.length === 0) return null;
  const index = files.findIndex((file) => file.path === activePath);
  if (index === -1) return direction === 1 ? files[0] : files[files.length - 1];
  const next = index + direction;
  if (next < 0 || next >= files.length) return null;
  return files[next];
}

export function nextUnreviewedFile(
  files: readonly DiffFileContract[],
  fromPath: string,
  reviewedPaths: ReadonlySet<string>,
): DiffFileContract | null {
  const start = files.findIndex((file) => file.path === fromPath);
  for (let step = 1; step <= files.length; step += 1) {
    const candidate = files[(start + step) % files.length];
    if (candidate.path !== fromPath && !reviewedPaths.has(candidate.path)) return candidate;
  }
  return null;
}

export function clampBlockIndex(current: number, direction: 1 | -1, blockCount: number): number {
  if (blockCount === 0) return -1;
  return Math.min(Math.max(current + direction, 0), blockCount - 1);
}

function isChangedRow(row: Element): boolean {
  const operator = row.querySelector(".diff-line-content-operator")?.textContent?.trim();
  return operator === "+" || operator === "-";
}

/** Split mode renders the old and new sides as two row-aligned tables; unified renders one. */
function panes(container: ParentNode): HTMLElement[][] {
  const tables = [...container.querySelectorAll<HTMLElement>("table")];
  if (tables.length === 0) return [[...container.querySelectorAll<HTMLElement>("tr.diff-line")]];
  return tables.map((table) => [...table.querySelectorAll<HTMLElement>("tr.diff-line")]);
}

/** Rows are walked by position across panes so a split-mode change anchors once, not once per side. */
export function changeBlockRows(container: ParentNode): HTMLElement[] {
  const sides = panes(container);
  const height = Math.max(0, ...sides.map((rows) => rows.length));
  const blocks: HTMLElement[] = [];
  let inBlock = false;
  for (let position = 0; position < height; position += 1) {
    const changed = sides
      .map((rows) => rows[position])
      .find((row) => row !== undefined && isChangedRow(row));
    if (changed !== undefined && !inBlock) blocks.push(changed);
    inBlock = changed !== undefined;
  }
  return blocks;
}

export function revealAndFocus(element: HTMLElement, block: RevealBlock): void {
  scrollIntoContainer(element, block);
  if (isEditableTarget(document.activeElement)) return;
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
}
