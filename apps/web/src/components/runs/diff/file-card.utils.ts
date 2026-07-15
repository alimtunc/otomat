import type { DiffFileContract, ReviewCommentContract } from "@otomat/domain";

/** Shapes the per-line comments into @git-diff-view's `extendData` contract (new side only). */
export function extendDataFor(commentsByLine: Map<number, ReviewCommentContract[]>) {
  const newFile: Record<string, { data: ReviewCommentContract[] }> = {};
  for (const [line, comments] of commentsByLine) {
    newFile[String(line)] = { data: comments };
  }
  return { newFile };
}

/** A note to render in place of the diff body when a file has no textual hunk, else null. */
export function unrenderableNote(file: DiffFileContract): string | null {
  if (file.binary) return "Binary file — no textual diff.";
  if (file.patch === "") return "Git emitted no hunk for this file.";
  return null;
}
