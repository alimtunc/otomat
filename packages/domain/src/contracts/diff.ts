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
  /** Sha of the head side; a live worktree's is a tree object, uncommitted work included. */
  head: z.string(),
  files: z.array(diffFileContractSchema),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  /** sha256 of the full canonical patch — the whole-diff identity. */
  sha: z.string(),
});
export type ReviewDiffContract = z.infer<typeof reviewDiffContractSchema>;

/** What a caller asks a diff read for; the response echoes back the scope that answered. */
const runDiffScopeSelectorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("branch") }),
  z.object({ kind: z.literal("commit"), commit: z.string().min(1) }),
  z.object({ kind: z.literal("step"), step: z.string().min(1) }),
  z.object({ kind: z.literal("pull_request") }),
  z.object({ kind: z.literal("session"), session: z.string().min(1) }),
]);
export type RunDiffScopeSelector = z.infer<typeof runDiffScopeSelectorSchema>;

export const BRANCH_DIFF_SCOPE: RunDiffScopeSelector = { kind: "branch" };

/** Every key the selector can occupy, so switching scope clears the one the previous scope named. */
export type RunDiffScopeParams = {
  scope: Exclude<RunDiffScopeSelector["kind"], "branch"> | undefined;
  commit: string | undefined;
  step: string | undefined;
  session: string | undefined;
};

/** The selector as query parameters — one spelling shared by the client, the cockpit's URL and its query keys. */
export function runDiffScopeParams(selector: RunDiffScopeSelector): RunDiffScopeParams {
  return {
    scope: selector.kind === "branch" ? undefined : selector.kind,
    commit: selector.kind === "commit" ? selector.commit : undefined,
    step: selector.kind === "step" ? selector.step : undefined,
    session: selector.kind === "session" ? selector.session : undefined,
  };
}

/** What a diff response was actually computed from, so a reader never has to infer which scope answered. */
export const runDiffScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("branch"),
    /** Both null when nothing answered, so no branch and no base could be named. */
    branch: z.string().nullable(),
    base_ref: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("commit"),
    commit: z.string(),
    short_sha: z.string(),
    subject: z.string(),
    /** Parent this commit is diffed against; null on a root commit, which is diffed against the empty tree. */
    parent: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("step"),
    step_run_id: z.string(),
    step_name: z.string(),
    /** 1-based position of the step in the run's plan, so a repeated name still reads apart. */
    step_number: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("pull_request"),
    /** Null while GitHub has not numbered the pull request yet. */
    number: z.number().int().positive().nullable(),
  }),
  z.object({
    kind: z.literal("session"),
    agent_session_id: z.string(),
    step_name: z.string(),
  }),
]);
export type RunDiffScope = z.infer<typeof runDiffScopeSchema>;

/** `diff` is null when the scope could not be reconstructed — `unavailable` then says why, and the UI states it instead of falling back. */
export const reviewDiffResponseSchema = z.object({
  /** The run or the pull request the diff was read from. */
  subject_id: z.string(),
  computed_at: z.iso.datetime(),
  diff: reviewDiffContractSchema.nullable(),
  scope: runDiffScopeSchema,
  unavailable: z.string().nullable(),
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
