import { z } from "zod";

import { pullRequestContractSchema } from "./entities/pull-request.js";

export const workspaceCommitSchema = z.object({
  sha: z.string().min(1),
  subject: z.string(),
});
export type WorkspaceCommit = z.infer<typeof workspaceCommitSchema>;

/** Why abandoning is refused right now. `run_active` is the one-writer rule: cancel the run first. */
export const WORKSPACE_ABANDON_BLOCKERS = ["workspace_closed", "run_active"] as const;
export type WorkspaceAbandonBlocker = (typeof WORKSPACE_ABANDON_BLOCKERS)[number];

export const workspaceAbandonErrorSchema = z.object({
  error: z.enum(WORKSPACE_ABANDON_BLOCKERS),
  message: z.string(),
});

/** Everything abandoning would leave behind, read from git at the moment of asking: abandon deletes nothing, so this is what stays reachable. */
export const workspaceClosureFactsSchema = z.object({
  run_id: z.string(),
  branch: z.string(),
  base_branch: z.string().nullable(),
  /** Null once the worktree directory is gone; the branch and its commits remain. */
  worktree_path: z.string().nullable(),
  /** Newest first, capped for display; `commit_count` carries the real total. */
  commits: z.array(workspaceCommitSchema),
  commit_count: z.number().int().nonnegative(),
  uncommitted_files: z.number().int().nonnegative(),
  changed_files: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  blocker: z.enum(WORKSPACE_ABANDON_BLOCKERS).nullable(),
});
/** The git and cycle half of the summary; the daemon's git layer owns it, the API layer attaches the pull request. */
export type WorkspaceClosureFacts = z.infer<typeof workspaceClosureFactsSchema>;

export const workspaceClosureSummarySchema = workspaceClosureFactsSchema.extend({
  pull_request: pullRequestContractSchema.nullable(),
});
export type WorkspaceClosureSummary = z.infer<typeof workspaceClosureSummarySchema>;
