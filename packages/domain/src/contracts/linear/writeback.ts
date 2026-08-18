import { z } from "zod";

import { LINEAR_WRITE_STATES } from "../entity-states.js";
import { linearIssueDraftSchema, linearIssueSnapshotSchema } from "./editing.js";
import {
  issueSourceLifecycleSchema,
  linearLifecycleSyncStateSchema,
  UNMAPPED_ISSUE_SOURCE_LIFECYCLE,
} from "./lifecycle.js";

export const LINEAR_WRITE_KINDS = ["fields", "status", "comment", "pr_link", "lifecycle"] as const;
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
  lifecycle: linearLifecycleSyncStateSchema.nullable().default(null),
  /** An unmapped phase is why this issue has no lifecycle write. */
  lifecycle_mapping: issueSourceLifecycleSchema.default(UNMAPPED_ISSUE_SOURCE_LIFECYCLE),
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
