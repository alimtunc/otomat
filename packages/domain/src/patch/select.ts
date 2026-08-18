import { parsePatchHunks, type PatchHunk } from "./parse.js";
import type { PatchRange } from "./range.js";

function patchPreamble(patch: string): string[] {
  const rows = patch.split("\n");
  const first = rows.findIndex((row) => row.startsWith("@@"));
  return first === -1 ? rows : rows.slice(0, first);
}

function overlaps(hunk: PatchHunk, range: PatchRange): boolean {
  const start = range.side === "new" ? hunk.newStart : hunk.oldStart;
  const count = range.side === "new" ? hunk.newCount : hunk.oldCount;
  return start <= range.endLine && start + count - 1 >= range.startLine;
}

/** Preamble kept so it stays a readable unified diff; null when no hunk touches `range`. */
export function narrowPatchToRange(patch: string, range: PatchRange): string | null {
  const selected = parsePatchHunks(patch).filter((hunk) => overlaps(hunk, range));
  if (selected.length === 0) return null;
  return [...patchPreamble(patch), ...selected.map((hunk) => hunk.text)].join("\n");
}
