import { z } from "zod";

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
