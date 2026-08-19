import type { PullRequestRow } from "@otomat/db";
import type { ReviewDestinationAvailability, ReviewFixAuthority } from "@otomat/domain";

/**
 * The commit a review comment may anchor to: what Otomat pushed for a pull
 * request it opened, what GitHub reports for one it adopted. GitHub rejects a
 * sha its diff does not carry, so the two cases genuinely differ.
 */
export function reviewAnchorSha(row: PullRequestRow): string | null {
  return row.origin === "imported" ? row.head_sha : row.published_head_sha;
}

const OWNERSHIP_REASON = {
  otomat: (row) =>
    `Otomat owns ${row.head_ref ?? "this branch"}, but an AI fix runs on its own run, not on this imported view.`,
  external: (row) =>
    `${row.author_login === null ? "Someone else" : `@${row.author_login}`} owns ${row.head_ref ?? "this branch"}. Otomat reviews it here; it never rewrites it.`,
  unknown: (row) =>
    `Otomat cannot verify who owns ${row.head_ref ?? "this branch"}, so this pull request stays review-only.`,
} satisfies Record<PullRequestRow["provenance"], (row: PullRequestRow) => string>;

/** An adopted pull request is always review-only: Otomat holds no worktree for it and must never move a branch it did not create. */
export function importedFixAuthority(row: PullRequestRow): ReviewFixAuthority {
  return { kind: "external", reason: OWNERSHIP_REASON[row.provenance](row) };
}

export function importedDestinations(row: PullRequestRow): ReviewDestinationAvailability {
  if (row.number === null || reviewAnchorSha(row) === null) {
    return {
      pr_review: false,
      reason: "This pull request has no head commit to anchor a review comment on.",
    };
  }
  if (row.status === "merged" || row.status === "closed") {
    return {
      pr_review: false,
      reason: `Pull request #${row.number} is ${row.status}; comments stay local.`,
    };
  }
  return { pr_review: true, reason: `Pull request #${row.number} is open for review.` };
}
