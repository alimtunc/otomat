import type { ReviewCommentContract, RunDiffContract } from "@otomat/domain";

export interface PartitionedComments {
  /** Open comments still matching the live diff, grouped by file path then by line. */
  anchored: Map<string, Map<number, ReviewCommentContract[]>>;
  /** Comments detached from the live diff (closed, or whose anchor sha no longer matches a live file); rendered against their snapshot. */
  archived: ReviewCommentContract[];
}

function isAnchored(diff: RunDiffContract | null, comment: ReviewCommentContract): boolean {
  if (comment.status !== "open" || diff === null) return false;
  return diff.files.some(
    (file) => file.path === comment.file_path && file.sha === comment.diff_sha,
  );
}

/** Anchors are immutable: a comment either matches the live diff exactly or renders against its snapshot. */
export function partitionComments(
  diff: RunDiffContract | null,
  comments: ReviewCommentContract[],
): PartitionedComments {
  const anchored = new Map<string, Map<number, ReviewCommentContract[]>>();
  const archived: ReviewCommentContract[] = [];

  for (const comment of comments) {
    if (!isAnchored(diff, comment)) {
      archived.push(comment);
      continue;
    }
    const byLine = anchored.get(comment.file_path) ?? new Map<number, ReviewCommentContract[]>();
    const atLine = byLine.get(comment.line) ?? [];
    atLine.push(comment);
    byLine.set(comment.line, atLine);
    anchored.set(comment.file_path, byLine);
  }

  return { anchored, archived };
}

export function openCommentIds(comments: ReviewCommentContract[]): string[] {
  return comments.filter((comment) => comment.status === "open").map((comment) => comment.id);
}
