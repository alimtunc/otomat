import type { ReviewCommentContract, RunDiffContract } from "@otomat/domain";

export interface PartitionedComments {
  byLine: Map<string, Map<number, ReviewCommentContract[]>>;
  byFile: Map<string, ReviewCommentContract[]>;
  detached: ReviewCommentContract[];
  /** Files carrying at least one placeable open comment; Hide reviewed must not swallow them. */
  commentedPaths: ReadonlySet<string>;
  anchoredIds: ReadonlySet<string>;
}

function isAnchored(diff: RunDiffContract | null, comment: ReviewCommentContract): boolean {
  if (comment.status !== "open" || diff === null) return false;
  return diff.files.some(
    (file) => file.path === comment.file_path && file.sha === comment.diff_sha,
  );
}

/** Anchors are immutable: a comment either matches the live diff exactly or falls back to its pin. */
export function partitionComments(
  diff: RunDiffContract | null,
  comments: ReviewCommentContract[],
): PartitionedComments {
  const byLine = new Map<string, Map<number, ReviewCommentContract[]>>();
  const byFile = new Map<string, ReviewCommentContract[]>();
  const detached: ReviewCommentContract[] = [];
  const commentedPaths = new Set<string>();
  const anchoredIds = new Set<string>();

  for (const comment of comments) {
    if (!isAnchored(diff, comment)) {
      detached.push(comment);
      continue;
    }
    commentedPaths.add(comment.file_path);
    anchoredIds.add(comment.id);
    if (comment.line === null) {
      const onFile = byFile.get(comment.file_path) ?? [];
      onFile.push(comment);
      byFile.set(comment.file_path, onFile);
      continue;
    }
    const lines = byLine.get(comment.file_path) ?? new Map<number, ReviewCommentContract[]>();
    const atLine = lines.get(comment.line) ?? [];
    atLine.push(comment);
    lines.set(comment.line, atLine);
    byLine.set(comment.file_path, lines);
  }

  return { byLine, byFile, detached, commentedPaths, anchoredIds };
}
