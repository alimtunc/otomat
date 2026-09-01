import { getPullRequestForRun, type Db, type PullRequestRow } from "@otomat/db";
import type { ReviewDestinationAvailability, ReviewFixAuthority } from "@otomat/domain";

import {
  hasCommit,
  publishedPullRequestTrees,
  type PullRequestTrees,
  type RepositoryBinding,
} from "#git";

/**
 * The commit a review comment may anchor to: what Otomat pushed for a pull
 * request it opened, what GitHub reports for one it adopted. GitHub rejects a
 * sha its diff does not carry, so the two cases genuinely differ.
 */
export function reviewAnchorSha(row: PullRequestRow): string | null {
  return row.origin === "imported" ? row.head_sha : row.published_head_sha;
}

/** Scope and subject both read this, so comments anchor to the same base the reviewer sees. */
export function runDiffBaseRef(db: Db, runId: string): string | undefined {
  return getPullRequestForRun(db, runId)?.base_ref || undefined;
}

/** An import is pinned to the pair it fetched; a published head is only ever as current as its fork from the base. */
export function pullRequestTrees(
  row: PullRequestRow,
  binding: RepositoryBinding,
): PullRequestTrees | null {
  const head = reviewAnchorSha(row);
  if (head === null || head === "") return null;
  if (row.origin !== "imported") {
    if (row.base_ref === null || row.base_ref === "") return null;
    return publishedPullRequestTrees(binding.rootPath, row.base_ref, head);
  }
  if (row.base_sha === null || row.base_sha === "") return null;
  return hasCommit(binding.rootPath, head) ? { base: row.base_sha, head } : null;
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
