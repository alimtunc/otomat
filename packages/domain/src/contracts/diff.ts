import { z } from "zod";

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

/** The canonical git diff of a run's worktree against its fork point. Never fabricated. */
export const runDiffContractSchema = z.object({
  /** Commit sha the diff is computed against (the worktree's fork point). */
  base: z.string(),
  files: z.array(diffFileContractSchema),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** sha256 of the full canonical patch — the whole-diff identity. */
  sha: z.string(),
});
export type RunDiffContract = z.infer<typeof runDiffContractSchema>;

/** `diff` is null when the run has no worktree to diff — the UI must say so, not fake one. */
export const runDiffResponseSchema = z.object({
  run_id: z.string(),
  computed_at: z.iso.datetime(),
  diff: runDiffContractSchema.nullable(),
});
export type RunDiffResponse = z.infer<typeof runDiffResponseSchema>;
