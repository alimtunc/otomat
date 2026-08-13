import type { ReviewCommentContract, RunDiffContract } from "@otomat/domain";

import { countFileComments, type FileCommentCounts } from "./file-comment-counts";

export interface PartitionedComments {
  byLine: Map<string, Map<number, ReviewCommentContract[]>>;
  byFile: Map<string, ReviewCommentContract[]>;
  /** Comments no longer pinned to the live diff; they render outside any file card, at their excerpt. */
  detached: ReviewCommentContract[];
  /** Every comment of a file still in the diff, anchored or not — what its header states. */
  byPath: Map<string, ReviewCommentContract[]>;
  countsByPath: Map<string, FileCommentCounts>;
  /** Files carrying at least one open comment; Hide reviewed must not swallow them. */
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
  const byPath = new Map<string, ReviewCommentContract[]>();
  const commentedPaths = new Set<string>();
  const anchoredIds = new Set<string>();
  const diffPaths = new Set(diff?.files.map((file) => file.path) ?? []);

  for (const comment of comments) {
    if (diffPaths.has(comment.file_path)) {
      const onPath = byPath.get(comment.file_path) ?? [];
      onPath.push(comment);
      byPath.set(comment.file_path, onPath);
      if (comment.status === "open") commentedPaths.add(comment.file_path);
    }
    if (!isAnchored(diff, comment)) {
      detached.push(comment);
      continue;
    }
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

  const countsByPath = new Map(
    [...byPath].map(([path, onPath]) => [path, countFileComments(onPath, anchoredIds)] as const),
  );
  return { byLine, byFile, detached, byPath, countsByPath, commentedPaths, anchoredIds };
}
