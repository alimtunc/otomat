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
  "linear_project_not_found",
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

export const linearTeamContractSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
});
export type LinearTeamContract = z.infer<typeof linearTeamContractSchema>;

export const linearProjectContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  team_ids: z.array(z.string()),
});
export type LinearProjectContract = z.infer<typeof linearProjectContractSchema>;

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

export const syncLinearRequestSchema = z
  .object({
    source_id: z.string().min(1).optional(),
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
export type SyncLinearResponse = z.infer<typeof syncLinearResponseSchema>;
