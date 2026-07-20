import type { DiffFileContract } from "@otomat/domain";

/**
 * The file one step away from `activePath`, or null at a boundary. With no
 * active file, forward starts at the first file and backward at the last.
 */
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

export function clampHunkIndex(current: number, direction: 1 | -1, hunkCount: number): number {
  if (hunkCount === 0) return -1;
  return Math.min(Math.max(current + direction, 0), hunkCount - 1);
}

function isChangedRow(row: Element): boolean {
  const operator = row.querySelector(".diff-line-content-operator")?.textContent?.trim();
  return operator === "+" || operator === "-";
}

/**
 * First row of each contiguous changed block in the rendered diff, in document
 * order. @git-diff-view renders no dedicated hunk-header row for fully expanded
 * hunks, so blocks of +/- lines are the stable keyboard anchor.
 */
export function changeBlockRows(container: ParentNode): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  let inBlock = false;
  for (const row of container.querySelectorAll<HTMLElement>("tr.diff-line")) {
    const changed = isChangedRow(row);
    if (changed && !inBlock) blocks.push(row);
    inBlock = changed;
  }
  return blocks;
}
