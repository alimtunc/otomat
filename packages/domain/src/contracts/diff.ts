import { z } from "zod";

/** Which file a line belongs to: `old` is the diff's base side, `new` its head side. */
export const DIFF_SIDES = ["old", "new"] as const;
export const diffSideSchema = z.enum(DIFF_SIDES);
export type DiffSide = z.infer<typeof diffSideSchema>;

/** How a file changed relative to the diff base, mirroring `git diff --name-status`. */
export const CHANGE_STATUSES = [
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "type_changed",
] as const;
export const changeStatusSchema = z.enum(CHANGE_STATUSES);
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** One file of the canonical git diff. `sha` is the stable per-file pin-to-SHA anchor. */
export const diffFileContractSchema = z.object({
  path: z.string(),
  old_path: z.string().nullable(),
  status: changeStatusSchema,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  binary: z.boolean(),
  /** Unified diff text for this file; empty when git emits no hunk. */
  patch: z.string(),
  /** sha256 of `patch` — review comments pin to this value. */
  sha: z.string(),
});
export type DiffFileContract = z.infer<typeof diffFileContractSchema>;

/** The canonical git diff of a review subject: a run's worktree, or an imported pull request's pinned trees. Never fabricated. */
export const reviewDiffContractSchema = z.object({
  /** Commit sha the diff is computed against (the fork point, or the imported base). */
  base: z.string(),
  files: z.array(diffFileContractSchema),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** sha256 of the full canonical patch — the whole-diff identity. */
  sha: z.string(),
});
export type ReviewDiffContract = z.infer<typeof reviewDiffContractSchema>;

/** `diff` is null when the subject has nothing to diff from — the UI must say so, not fake one. */
export const reviewDiffResponseSchema = z.object({
  /** The run or the pull request the diff was read from. */
  subject_id: z.string(),
  computed_at: z.iso.datetime(),
  diff: reviewDiffContractSchema.nullable(),
});
export type ReviewDiffResponse = z.infer<typeof reviewDiffResponseSchema>;

/** The exact base and head blobs behind one diff file, so context can be expanded without guessing. */
export const diffFileBlobsResponseSchema = z.object({
  base_content: z.string().nullable(),
  head_content: z.string().nullable(),
});
export type DiffFileBlobsResponse = z.infer<typeof diffFileBlobsResponseSchema>;

/** Why the daemon could not hand back a file's blobs; each one is a state the UI states plainly. */
export const DIFF_FILE_BLOBS_ERRORS = [
  "diff_unavailable",
  "file_not_in_diff",
  "file_not_expandable",
  "blobs_anchor_stale",
  "file_too_large",
] as const;
export type DiffFileBlobsError = (typeof DIFF_FILE_BLOBS_ERRORS)[number];

export const diffFileBlobsErrorSchema = z.object({ error: z.enum(DIFF_FILE_BLOBS_ERRORS) });
