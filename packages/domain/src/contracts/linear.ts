import { z } from "zod";

import { LINEAR_WRITE_STATES } from "../state-machines/linear-write.js";

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

/** Linear numeric priority. 0 None, 1 Urgent, 2 High, 3 Medium, 4 Low. */
export const LINEAR_PRIORITIES = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
] as const;

export const linearPrioritySchema = z.number().int().min(0).max(4);

/** The issue fields a user may edit locally before publishing them to Linear. */
export const linearEditableFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().nullable(),
  priority: linearPrioritySchema,
  assignee_id: z.string().min(1).nullable(),
  label_ids: z.array(z.string().min(1)),
});
export type LinearEditableFields = z.infer<typeof linearEditableFieldsSchema>;

export const linearUserRefSchema = z.object({ id: z.string(), name: z.string() });
export const linearLabelRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export const linearStateRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  color: z.string(),
});

/** Live snapshot of the remote issue, the conflict base for an edit. */
export const linearIssueSnapshotSchema = linearEditableFieldsSchema.extend({
  external_id: z.string().min(1),
  identifier: z.string().min(1),
  url: z.url().nullable(),
  updated_at: z.iso.datetime(),
  assignee: linearUserRefSchema.nullable(),
  labels: z.array(linearLabelRefSchema),
  state: linearStateRefSchema,
});
export type LinearIssueSnapshot = z.infer<typeof linearIssueSnapshotSchema>;

/** Real team metadata backing the edit form's selectors. */
export const linearTeamMetadataSchema = z.object({
  team_id: z.string(),
  states: z.array(linearStateRefSchema),
  members: z.array(linearUserRefSchema),
  labels: z.array(linearLabelRefSchema),
});
export type LinearTeamMetadata = z.infer<typeof linearTeamMetadataSchema>;

/** GET /editor — the network-backed base for editing (409 when offline). */
export const linearEditorStateSchema = z.object({
  snapshot: linearIssueSnapshotSchema,
  team_metadata: linearTeamMetadataSchema,
});
export type LinearEditorState = z.infer<typeof linearEditorStateSchema>;

/** Persistent local draft, distinct from the mirror; survives offline/restart. */
export const linearIssueDraftSchema = linearEditableFieldsSchema.extend({
  id: z.string(),
  issue_id: z.string(),
  base_updated_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type LinearIssueDraft = z.infer<typeof linearIssueDraftSchema>;

export const saveLinearDraftRequestSchema = linearEditableFieldsSchema
  .extend({ base_updated_at: z.iso.datetime() })
  .strict();
export type SaveLinearDraftRequest = z.infer<typeof saveLinearDraftRequestSchema>;

export const LINEAR_WRITE_KINDS = ["fields", "status", "comment", "pr_link"] as const;
export const linearWriteKindSchema = z.enum(LINEAR_WRITE_KINDS);
export type LinearWriteKind = z.infer<typeof linearWriteKindSchema>;

/** One persisted, auditable Linear write attempt (no secret material). */
export const linearWriteContractSchema = z.object({
  id: z.string(),
  issue_id: z.string(),
  run_id: z.string().nullable(),
  kind: linearWriteKindSchema,
  status: z.enum(LINEAR_WRITE_STATES),
  idempotency_key: z.string(),
  detail: z.string().nullable(),
  remote_id: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export type LinearWriteContract = z.infer<typeof linearWriteContractSchema>;

/** GET /writeback — local-only state, always available (even offline). */
export const linearWritebackStateSchema = z.object({
  draft: linearIssueDraftSchema.nullable(),
  writes: z.array(linearWriteContractSchema),
});
export type LinearWritebackState = z.infer<typeof linearWritebackStateSchema>;

export const publishFieldsRequestSchema = z
  .object({ overwrite: z.boolean().default(false) })
  .strict();
export type PublishFieldsRequest = z.infer<typeof publishFieldsRequestSchema>;

export const publishStatusRequestSchema = z
  .object({ state_id: z.string().min(1), run_id: z.string().min(1).nullable().optional() })
  .strict();
export type PublishStatusRequest = z.infer<typeof publishStatusRequestSchema>;

export const publishCommentRequestSchema = z
  .object({
    client_id: z.uuid(),
    body: z.string().trim().min(1),
    run_id: z.string().min(1).nullable().optional(),
    parent_id: z.string().min(1).nullable().optional(),
  })
  .strict();
export type PublishCommentRequest = z.infer<typeof publishCommentRequestSchema>;

/** One remote issue comment; `parent_id` links a reply to its thread root. */
export const linearCommentSchema = z.object({
  id: z.string().min(1),
  body: z.string(),
  author_name: z.string().nullable(),
  created_at: z.iso.datetime(),
  parent_id: z.string().nullable(),
});
export type LinearCommentContract = z.infer<typeof linearCommentSchema>;

/** GET /comments — network-backed read of the remote thread (409 when offline). */
export const linearCommentsResponseSchema = z.object({
  comments: z.array(linearCommentSchema),
});

export const publishPrLinkRequestSchema = z
  .object({
    url: z.url(),
    title: z.string().trim().min(1),
    run_id: z.string().min(1).nullable().optional(),
  })
  .strict();
export type PublishPrLinkRequest = z.infer<typeof publishPrLinkRequestSchema>;

/** 409 body when a fields publish is blocked by a concurrent remote change. */
export const linearWriteConflictSchema = z.object({
  error: z.literal("linear_write_conflict"),
  message: z.string(),
  remote: linearIssueSnapshotSchema,
});
export type LinearWriteConflict = z.infer<typeof linearWriteConflictSchema>;
