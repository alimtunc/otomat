import type { ReviewCommentContract } from "@otomat/domain";

/** What a file's header has to state without opening anything: how much feedback it carries and in what shape. */
export interface FileCommentCounts {
  open: number;
  addressed: number;
  agent: number;
  prReview: number;
  /** Open comments whose anchor no longer matches the live diff. */
  stale: number;
}

export const EMPTY_FILE_COMMENT_COUNTS: FileCommentCounts = {
  open: 0,
  addressed: 0,
  agent: 0,
  prReview: 0,
  stale: 0,
};

export function countFileComments(
  comments: readonly ReviewCommentContract[],
  anchoredIds: ReadonlySet<string>,
): FileCommentCounts {
  const counts = { ...EMPTY_FILE_COMMENT_COUNTS };
  for (const comment of comments) {
    if (comment.status === "open") counts.open += 1;
    else counts.addressed += 1;
    if (comment.destination === "pr_review") counts.prReview += 1;
    else counts.agent += 1;
    if (comment.status === "open" && !anchoredIds.has(comment.id)) counts.stale += 1;
  }
  return counts;
}

/** Screen-reader wording for the header indicator: a number and a state, never an unnamed icon. */
export function describeFileComments(path: string, counts: FileCommentCounts): string {
  const total = counts.open + counts.addressed;
  const parts = [`${total} comment${total === 1 ? "" : "s"} on ${path}`];
  parts.push(counts.open === 0 ? "all addressed" : `${counts.open} open`);
  if (counts.prReview > 0) parts.push(`${counts.prReview} on the pull request review`);
  if (counts.stale > 0) parts.push(`${counts.stale} stale`);
  return parts.join(", ");
}
