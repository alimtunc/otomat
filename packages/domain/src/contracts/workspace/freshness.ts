import { z } from "zod";

import { baseRefusalSchema, remoteBaseRefusalSchema } from "../run.js";
import { WORKSPACE_ABANDON_BLOCKERS } from "./closure.js";

const WORKSPACE_UPDATE_STRATEGIES = ["rebase", "merge"] as const;
export type WorkspaceUpdateStrategy = (typeof WORKSPACE_UPDATE_STRATEGIES)[number];

/** `branch` is the run's own branch as its remote carries it; `base` is the branch the work lands on. */
const WORKSPACE_UPDATE_SOURCES = ["branch", "base"] as const;

const remoteRefComparisonSchema = z.object({
  ref: z.string().min(1),
  sha: z.string().min(1),
  /** Workspace commits the remote ref does not carry. */
  ahead: z.number().int().nonnegative(),
  /** Remote commits the workspace does not carry yet. */
  behind: z.number().int().nonnegative(),
  /** Integrations that keep local work and rewrite nothing already published; empty when there is nothing to take, or it must wait. */
  strategies: z.array(z.enum(WORKSPACE_UPDATE_STRATEGIES)),
});
export type RemoteRefComparison = z.infer<typeof remoteRefComparisonSchema>;

const comparedWorkspaceFreshnessSchema = z.object({
  state: z.enum(["up_to_date", "behind", "diverged"]),
  /** Null while the remote has never carried the run's branch. */
  branch: remoteRefComparisonSchema.nullable(),
  /** Null when the base exists only locally. */
  base: remoteRefComparisonSchema.nullable(),
  /** Uncommitted work, which an update refuses to carry. */
  dirty: z.boolean(),
});
export type ComparedWorkspaceFreshness = z.infer<typeof comparedWorkspaceFreshnessSchema>;

/** How the run's worktree stands against its remote refs, read from a fetch made for this answer. */
export const workspaceFreshnessSchema = z.discriminatedUnion("state", [
  comparedWorkspaceFreshnessSchema,
  z.object({ state: z.literal("unverifiable"), failure: baseRefusalSchema }),
]);
export type WorkspaceFreshness = z.infer<typeof workspaceFreshnessSchema>;

export const updateWorkspaceRequestSchema = z
  .object({
    source: z.enum(WORKSPACE_UPDATE_SOURCES),
    strategy: z.enum(WORKSPACE_UPDATE_STRATEGIES),
  })
  .strict();
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;

/** `update_conflict` and `update_failed` were aborted, leaving the workspace as it was. */
const WORKSPACE_UPDATE_ERRORS = [
  ...WORKSPACE_ABANDON_BLOCKERS,
  "workspace_updating",
  "workspace_dirty",
  "remote_unavailable",
  "strategy_unavailable",
  "update_conflict",
  "update_failed",
] as const;
export type WorkspaceUpdateError = (typeof WORKSPACE_UPDATE_ERRORS)[number];

export const WORKSPACE_UPDATE_BLOCKED = {
  run_active: "A turn is running in this workspace; update it once the turn ends.",
  workspace_dirty:
    "The workspace has uncommitted changes; commit or discard them before updating it.",
} satisfies Partial<Record<WorkspaceUpdateError, string>>;

export const workspaceUpdateErrorSchema = z.object({
  error: z.enum(WORKSPACE_UPDATE_ERRORS),
  message: z.string(),
  /** The paths git could not reconcile, on `update_conflict`. */
  conflicts: z.array(z.string()).default([]),
  /** Set on `remote_unavailable`. */
  remote: remoteBaseRefusalSchema.nullable().default(null),
});
export type WorkspaceUpdateErrorBody = z.infer<typeof workspaceUpdateErrorSchema>;
