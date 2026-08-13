import type { DiffSide } from "../contracts/diff.js";
import { parsePatchHunks, type PatchHunk, type PatchLine } from "./parse.js";

/** An inclusive span of lines on one side of one file's patch. */
export interface PatchRange {
  side: DiffSide;
  startLine: number;
  endLine: number;
}

function lineNumber(line: PatchLine, side: DiffSide): number | null {
  return side === "new" ? line.newLine : line.oldLine;
}

function coveredLines(hunk: PatchHunk, range: PatchRange): PatchLine[] {
  return hunk.lines.filter((line) => {
    const number = lineNumber(line, range.side);
    return number !== null && number >= range.startLine && number <= range.endLine;
  });
}

/** The single hunk holding every line of `range`, or null when no one hunk does. */
export function hunkCoveringRange(patch: string, range: PatchRange): PatchHunk | null {
  const wanted = range.endLine - range.startLine + 1;
  for (const hunk of parsePatchHunks(patch)) {
    if (coveredLines(hunk, range).length === wanted) return hunk;
  }
  return null;
}

/** The patch's own text for `range` — the exact code a suggestion replaces. Null when the range is not in one hunk. */
export function readRangeLines(patch: string, range: PatchRange): string[] | null {
  const hunk = hunkCoveringRange(patch, range);
  if (hunk === null) return null;
  return coveredLines(hunk, range).map((line) => line.text);
}

/** Why `range` is not a usable span at all, or null when it is. */
export function rangeShapeRefusal(range: PatchRange): string | null {
  if (range.startLine < 1 || range.endLine < range.startLine) {
    return "The selected range ends before it starts.";
  }
  return null;
}

/** GitHub anchors a comment only to lines its diff shows, and a multi-line one must stay inside a single hunk. */
export function reviewRangeRefusal(patch: string, range: PatchRange): string | null {
  const shape = rangeShapeRefusal(range);
  if (shape !== null) return shape;
  if (hunkCoveringRange(patch, range) === null) {
    return `GitHub anchors a review comment only to lines its diff shows, inside a single hunk. Lines ${range.startLine}–${range.endLine} of this file are not.`;
  }
  return null;
}

/** Why `range` cannot carry a code suggestion, or null when it can. */
export function suggestionRefusal(patch: string, range: PatchRange): string | null {
  if (range.side !== "new") {
    return "A suggestion replaces head lines, so it needs a range on the new side of the diff.";
  }
  const shape = rangeShapeRefusal(range);
  if (shape !== null) return shape;
  if (hunkCoveringRange(patch, range) === null) {
    return `A suggestion replaces exactly the lines the diff shows. Lines ${range.startLine}–${range.endLine} of this file are not all inside one hunk of it.`;
  }
  return null;
}
