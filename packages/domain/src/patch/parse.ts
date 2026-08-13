export type PatchLineKind = "context" | "added" | "removed";

export interface PatchLine {
  kind: PatchLineKind;
  /** Line content without its leading diff marker. */
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface PatchHunk {
  /** The hunk verbatim, header included — what a comment pins so a moved anchor still shows its code. */
  text: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: PatchLine[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function count(raw: string | undefined): number {
  return raw === undefined ? 1 : Number(raw);
}

function readLines(body: string[], hunk: PatchHunk): PatchLine[] {
  const lines: PatchLine[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const oldEnd = hunk.oldStart + hunk.oldCount;
  const newEnd = hunk.newStart + hunk.newCount;
  for (const raw of body) {
    // The header's counts bound the hunk: a trailing blank from the split, or a
    // context line some tool stripped to "", must not shift the numbering.
    if (oldLine >= oldEnd && newLine >= newEnd) break;
    const text = raw.slice(1);
    if (raw.startsWith("+")) {
      lines.push({ kind: "added", text, oldLine: null, newLine });
      newLine += 1;
    } else if (raw.startsWith("-")) {
      lines.push({ kind: "removed", text, oldLine, newLine: null });
      oldLine += 1;
    } else if (raw.startsWith(" ") || raw === "") {
      lines.push({ kind: "context", text, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }
  return lines;
}

/** Hunks of one file's unified diff, in patch order; text outside a hunk is ignored. */
export function parsePatchHunks(patch: string): PatchHunk[] {
  const rows = patch.split("\n");
  const spans: { hunk: PatchHunk; start: number; end: number }[] = [];
  for (const [index, row] of rows.entries()) {
    const match = HUNK_HEADER.exec(row);
    if (!match) continue;
    const previous = spans.at(-1);
    if (previous) previous.end = index;
    spans.push({
      hunk: {
        text: "",
        oldStart: Number(match[1]),
        oldCount: count(match[2]),
        newStart: Number(match[3]),
        newCount: count(match[4]),
        lines: [],
      },
      start: index,
      end: rows.length,
    });
  }
  return spans.map(({ hunk, start, end }) => ({
    ...hunk,
    text: rows.slice(start, end).join("\n"),
    lines: readLines(rows.slice(start + 1, end), hunk),
  }));
}
