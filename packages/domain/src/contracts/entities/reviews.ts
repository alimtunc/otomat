import { z } from "zod";

import { diffSideSchema } from "../diff.js";
import {
  REVIEW_COMMENT_PUBLICATION_STATES,
  REVIEW_COMMENT_STATES,
  REVIEW_STATES,
  REVIEWED_FILE_SYNC_STATES,
} from "../entity-states.js";

export const reviewContractSchema = z.object({
  id: z.string(),
  /** The run or the pull request this review surface belongs to. */
  subject_id: z.string(),
  status: z.enum(REVIEW_STATES),
});
export type ReviewContract = z.infer<typeof reviewContractSchema>;

/** Where a comment is meant to land: an Otomat instruction the AI fix can consume, or a comment on the GitHub pull request. */
export const REVIEW_COMMENT_DESTINATIONS = ["agent", "pr_review"] as const;
export const reviewCommentDestinationSchema = z.enum(REVIEW_COMMENT_DESTINATIONS);
export type ReviewCommentDestination = z.infer<typeof reviewCommentDestinationSchema>;

export function isReviewCommentDestination(value: string): value is ReviewCommentDestination {
  return REVIEW_COMMENT_DESTINATIONS.some((option) => option === value);
}

/** Pin-to-SHA review comment: `(file_path, side, start_line, line, diff_sha)` is immutable, never live-migrated. */
export const reviewCommentContractSchema = z.object({
  id: z.string(),
  review_id: z.string(),
  file_path: z.string(),
  side: diffSideSchema,
  /** First line of a multi-line anchor; null when the comment covers `line` alone or the whole file. */
  start_line: z.number().int().positive().nullable(),
  /** Null pins the comment to the whole file at `diff_sha` instead of a line range. */
  line: z.number().int().nonnegative().nullable(),
  diff_sha: z.string(),
  body: z.string(),
  status: z.enum(REVIEW_COMMENT_STATES),
  destination: reviewCommentDestinationSchema,
  publication_status: z.enum(REVIEW_COMMENT_PUBLICATION_STATES),
  /** Verbatim reason the last publication attempt failed; the reviewer retries on it. */
  publication_error: z.string().nullable(),
  external_url: z.string().nullable(),
  suggestion: z.string().nullable(),
  /** The anchored lines as they read when the suggestion was written, so the replacement stays exact. */
  suggestion_original: z.string().nullable(),
  /** Hunk captured at comment time and shown when the anchor becomes stale. */
  hunk_snapshot: z.string(),
  fix_requested_at: z.iso.datetime().nullable(),
  fixed_by_session_id: z.string().nullable(),
});
export type ReviewCommentContract = z.infer<typeof reviewCommentContractSchema>;

/** One file the operator marked, pinned to the `diff_sha` it was read at: the mark holds while that sha does. */
export const reviewedFileContractSchema = z.object({
  id: z.string(),
  review_id: z.string(),
  file_path: z.string(),
  diff_sha: z.string(),
  reviewed: z.boolean(),
  sync_status: z.enum(REVIEWED_FILE_SYNC_STATES),
  /** Verbatim reason the last synchronization failed; the reviewer retries on it. */
  sync_error: z.string().nullable(),
});
export type ReviewedFileContract = z.infer<typeof reviewedFileContractSchema>;
