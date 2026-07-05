const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

interface HunkSpan {
  headerIndex: number;
  endIndex: number;
  newStart: number;
  newCount: number;
}

function collectHunks(lines: string[]): HunkSpan[] {
  const hunks: HunkSpan[] = [];
  for (const [index, text] of lines.entries()) {
    const match = HUNK_HEADER_RE.exec(text);
    if (!match) continue;
    const previous = hunks.at(-1);
    if (previous) previous.endIndex = index;
    hunks.push({
      headerIndex: index,
      endIndex: lines.length,
      newStart: Number(match[1]),
      newCount: match[2] === undefined ? 1 : Number(match[2]),
    });
  }
  return hunks;
}

/** The hunk of a unified diff covering the given new-side line, or null when no hunk contains it. */
export function extractHunkForLine(patch: string, line: number): string | null {
  const lines = patch.split("\n");
  for (const hunk of collectHunks(lines)) {
    if (hunk.newCount === 0) continue;
    if (line >= hunk.newStart && line < hunk.newStart + hunk.newCount) {
      return lines.slice(hunk.headerIndex, hunk.endIndex).join("\n");
    }
  }
  return null;
}
