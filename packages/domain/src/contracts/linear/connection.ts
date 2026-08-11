import { z } from "zod";

export const LINEAR_ERROR_CODES = [
  "linear_not_connected",
  "linear_unauthorized",
  "linear_rate_limited",
  "linear_unavailable",
  "linear_request_failed",
  "linear_request_superseded",
  "linear_source_not_found",
  "linear_source_already_mapped",
  "linear_source_invalid_selection",
  "linear_source_state_invalid",
  "linear_project_not_found",
  "linear_issue_not_found",
  "linear_remote_issue_not_found",
  "linear_issue_not_writable",
  "linear_write_conflict",
  "linear_write_not_found",
] as const;
export type LinearErrorCode = (typeof LINEAR_ERROR_CODES)[number];

export const linearConnectionContractSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("disconnected"),
    workspace_id: z.null(),
    workspace_name: z.null(),
    user_name: z.null(),
    error_code: z.null(),
    error_message: z.null(),
  }),
  z.object({
    status: z.literal("connected"),
    workspace_id: z.string().min(1),
    workspace_name: z.string(),
    user_name: z.string(),
    error_code: z.null(),
    error_message: z.null(),
  }),
  z.object({
    status: z.literal("failed"),
    workspace_id: z.null(),
    workspace_name: z.null(),
    user_name: z.null(),
    error_code: z.enum(LINEAR_ERROR_CODES),
    error_message: z.string(),
  }),
]);
export type LinearConnectionContract = z.infer<typeof linearConnectionContractSchema>;

export const connectLinearRequestSchema = z.object({ api_key: z.string().min(1) }).strict();
export type ConnectLinearRequest = z.infer<typeof connectLinearRequestSchema>;

export const linearErrorSchema = z.object({
  error: z.enum(LINEAR_ERROR_CODES),
  message: z.string(),
});

export const linearWorkflowStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type LinearWorkflowState = z.infer<typeof linearWorkflowStateSchema>;

export const linearTeamContractSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  states: z.array(linearWorkflowStateSchema),
});
export type LinearTeamContract = z.infer<typeof linearTeamContractSchema>;

export const linearProjectContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  team_ids: z.array(z.string()),
});

export const linearWorkspaceContractSchema = z.object({
  teams: z.array(linearTeamContractSchema),
  projects: z.array(linearProjectContractSchema),
});
export type LinearWorkspaceContract = z.infer<typeof linearWorkspaceContractSchema>;

export const createIssueSourceRequestSchema = z
  .object({
    project_id: z.string().min(1),
    external_team_id: z.string().min(1),
    external_project_id: z.string().min(1).optional(),
  })
  .strict();
export type CreateIssueSourceRequest = z.infer<typeof createIssueSourceRequestSchema>;

/** PATCH /sources/:id — the whole lifecycle mapping is rewritten; null unmaps a phase. */
export const updateIssueSourceRequestSchema = z
  .object({
    in_progress_state_id: z.string().min(1).nullable(),
    done_state_id: z.string().min(1).nullable(),
  })
  .strict();
export type UpdateIssueSourceRequest = z.infer<typeof updateIssueSourceRequestSchema>;

export const syncLinearRequestSchema = z
  .object({
    source_id: z.string().min(1).optional(),
    /** Restricts the sync to one project's mapped sources; ignored when `source_id` is given. */
    project_id: z.string().min(1).optional(),
    /** Ignores the stored watermark and re-reads every issue, repairing a cursor that drifted. */
    full: z.boolean().optional(),
  })
  .strict();
export type SyncLinearRequest = z.infer<typeof syncLinearRequestSchema>;

export const issueSourceSyncResultSchema = z.object({
  source_id: z.string(),
  imported: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  synced_at: z.iso.datetime(),
});
export type IssueSourceSyncResult = z.infer<typeof issueSourceSyncResultSchema>;

export const syncLinearResponseSchema = z.object({
  results: z.array(issueSourceSyncResultSchema),
});

/** One project's Linear freshness, as the daemon that owns that project knows it. */
export const linearSyncStatusSchema = z.object({
  project_id: z.string().min(1),
  /** Linear sources mapped to this project; zero means there is nothing to refresh. */
  sources: z.number().int().nonnegative(),
  running: z.boolean(),
  /** Oldest success across the project's sources; null while any of them has never synced. */
  last_synced_at: z.iso.datetime().nullable(),
  /** What the last completed pass wrote, or null when none has completed since the daemon started. */
  last_result: z
    .object({
      imported: z.number().int().nonnegative(),
      updated: z.number().int().nonnegative(),
    })
    .nullable(),
  /** The failure that ended the last pass, cleared by the next success. */
  last_error: z
    .object({
      code: z.enum(LINEAR_ERROR_CODES).nullable(),
      message: z.string().min(1),
    })
    .nullable(),
});
export type LinearSyncStatusContract = z.infer<typeof linearSyncStatusSchema>;
