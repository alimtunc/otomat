import { z } from "zod";

import { CHANGE_STATUSES } from "../contracts/diff.js";
import { PULL_REQUEST_STATES } from "../contracts/entity-states.js";

export const contextDiffFileSchema = z.object({
  path: z.string(),
  status: z.enum(CHANGE_STATUSES),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const contextDiffSchema = z.object({
  sha: z.string(),
  base: z.string(),
  files: z.array(contextDiffFileSchema),
  /** Files beyond the listed ones, so a large diff is summarised rather than silently cut. */
  omitted_files: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

export const contextWorkspaceSchema = z.object({
  repository: z.string(),
  /** Machine the daemon executes on, so a remote host is named as itself rather than implied. */
  host: z.string(),
  path: z.string().nullable(),
  branch: z.string(),
  base_branch: z.string().nullable(),
  head_sha: z.string().nullable(),
  dirty: z.boolean(),
  uncommitted_files: z.number().int().nonnegative(),
  commits: z.array(z.string()).default([]),
  /** Null when the worktree is gone; the reader is told so rather than shown a clean tree. */
  diff: contextDiffSchema.nullable(),
});
export type ContextWorkspace = z.infer<typeof contextWorkspaceSchema>;

/** Never a credential or a token: an agent cannot call GitHub with this. */
export const contextPullRequestSchema = z.object({
  number: z.number().int().positive(),
  url: z.string(),
  title: z.string(),
  state: z.enum(PULL_REQUEST_STATES),
  head_branch: z.string(),
  base_branch: z.string(),
  /** The commit pushed to `head_branch`, never the workspace head; null until something is published. */
  published_head_sha: z.string().nullable(),
});
export type ContextPullRequest = z.infer<typeof contextPullRequestSchema>;
