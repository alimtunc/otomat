import { z } from "zod";

const WORKSPACE_STATES = [
  "active",
  "cleanup_required",
  "stale",
  "missing",
  "unmanaged",
  "removed",
] as const;
const workspaceStateSchema = z.enum(WORKSPACE_STATES);
export type WorkspaceState = (typeof WORKSPACE_STATES)[number];

const WORKSPACE_CLEANUP_BLOCKERS = [
  "cycle_open",
  "worktree_dirty",
  "writer_alive",
  "worktree_unreadable",
  "unmanaged_worktree",
] as const;
const workspaceCleanupBlockerSchema = z.enum(WORKSPACE_CLEANUP_BLOCKERS);
export type WorkspaceCleanupBlocker = (typeof WORKSPACE_CLEANUP_BLOCKERS)[number];

const WORKSPACE_ATTACHMENTS = ["record", "convention", "ambiguous", "none"] as const;
const workspaceAttachmentSchema = z.enum(WORKSPACE_ATTACHMENTS);
export type WorkspaceAttachment = (typeof WORKSPACE_ATTACHMENTS)[number];

const workspacePullRequestSchema = z.object({
  number: z.number().int().positive().nullable(),
  url: z.string().nullable(),
  merged: z.boolean(),
});

export const workspaceEntrySchema = z.object({
  /** `worktrees.id` for a record-attached workspace, else the absolute path. */
  id: z.string(),
  repository_id: z.string(),
  repository_name: z.string(),
  repository_path: z.string(),
  issue_id: z.string().nullable(),
  issue_identifier: z.string().nullable(),
  issue_title: z.string().nullable(),
  run_id: z.string().nullable(),
  branch: z.string().nullable(),
  path: z.string(),
  state: workspaceStateSchema,
  attachment: workspaceAttachmentSchema,
  blocker: workspaceCleanupBlockerSchema.nullable(),
  reason: z.string(),
  registered: z.boolean(),
  present: z.boolean(),
  /** `null` when the working directory refused to answer `git status`. */
  dirty: z.boolean().nullable(),
  head_sha: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  pull_request: workspacePullRequestSchema.nullable(),
});
export type WorkspaceEntry = z.infer<typeof workspaceEntrySchema>;

/** A `removed` workspace has nothing left to act on, so it is counted nowhere. */
export const workspaceCountsSchema = z.object({
  active: z.number().int().nonnegative(),
  cleanup_required: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  unmanaged: z.number().int().nonnegative(),
});
export type WorkspaceCounts = z.infer<typeof workspaceCountsSchema>;

export const workspaceInventorySchema = z.object({
  entries: z.array(workspaceEntrySchema),
  counts: workspaceCountsSchema,
});
export type WorkspaceInventory = z.infer<typeof workspaceInventorySchema>;

export const workspaceReconcileReportSchema = z.object({
  pull_requests_refreshed: z.number().int().nonnegative(),
  pruned: z.number().int().nonnegative(),
  converged: z.number().int().nonnegative(),
  cleaned: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  inventory: workspaceInventorySchema,
});
export type WorkspaceReconcileReport = z.infer<typeof workspaceReconcileReportSchema>;

export const workspaceCleanupResultSchema = z.object({
  outcome: z.enum(["cleaned", "skipped", "failed"]),
  /** `null` when git itself refused the removal rather than a precondition. */
  blocker: workspaceCleanupBlockerSchema.nullable(),
  message: z.string(),
  entry: workspaceEntrySchema.nullable(),
});
export type WorkspaceCleanupResult = z.infer<typeof workspaceCleanupResultSchema>;

export const workspaceSettingsSchema = z.object({
  auto_delete_after_merge: z.boolean(),
});
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

const WORKSPACE_CLEANUP_ERRORS = ["workspace_not_found"] as const;
export const workspaceCleanupErrorSchema = z.object({
  error: z.enum(WORKSPACE_CLEANUP_ERRORS),
  message: z.string(),
});
