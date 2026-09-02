import { z } from "zod";

import { PULL_REQUEST_STATES } from "../state-machines/pull-request.js";
import {
  pullRequestChecksStateSchema,
  pullRequestMergeabilitySchema,
  pullRequestProvenanceSchema,
  pullRequestReviewDecisionSchema,
} from "./entities/pull-request.js";
import { pullRequestIssueLinkSchema } from "./pull-request/detail.js";

export const PULL_REQUEST_INBOX_GROUPS = [
  "needs_your_review",
  "needs_team_review",
  "your_drafts",
  "waiting_for_review",
  "needs_action",
  "ready_to_merge",
] as const;
export const pullRequestInboxGroupSchema = z.enum(PULL_REQUEST_INBOX_GROUPS);
export type PullRequestInboxGroup = z.infer<typeof pullRequestInboxGroupSchema>;

export const pullRequestInboxEntrySchema = z.object({
  id: z.string(),
  group: pullRequestInboxGroupSchema,
  repository: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string(),
  url: z.url().nullable(),
  author_login: z.string().nullable(),
  status: z.enum(PULL_REQUEST_STATES),
  provenance: pullRequestProvenanceSchema,
  review_decision: pullRequestReviewDecisionSchema.nullable(),
  checks_state: pullRequestChecksStateSchema,
  mergeable: pullRequestMergeabilitySchema,
  head_ref: z.string().nullable(),
  base_ref: z.string().nullable(),
  updated_at: z.iso.datetime(),
  run_id: z.string().nullable(),
  issue: pullRequestIssueLinkSchema.nullable(),
  /** False while Otomat holds no fetched head, so the reviewer offers to fetch one instead of failing. */
  head_fetched: z.boolean(),
});
export type PullRequestInboxEntry = z.infer<typeof pullRequestInboxEntrySchema>;

export const pullRequestInboxViewerSchema = z.object({
  login: z.string().nullable(),
  /** False when GitHub would not name the viewer's teams, so the team group states it cannot answer. */
  teams_known: z.boolean(),
});
export type PullRequestInboxViewer = z.infer<typeof pullRequestInboxViewerSchema>;

export const pullRequestInboxSyncSchema = z.object({
  running: z.boolean(),
  /** Repositories the pass reads; zero means the project has nothing to reconcile against. */
  repositories: z.number().int().nonnegative(),
  /** Oldest success across those repositories; null while any of them has never synced. */
  last_synced_at: z.iso.datetime().nullable(),
  last_error: z.object({ message: z.string().min(1) }).nullable(),
});
export type PullRequestInboxSync = z.infer<typeof pullRequestInboxSyncSchema>;

export const pullRequestInboxSchema = z.object({
  project_id: z.string().min(1),
  viewer: pullRequestInboxViewerSchema,
  sync: pullRequestInboxSyncSchema,
  entries: z.array(pullRequestInboxEntrySchema),
});
export type PullRequestInbox = z.infer<typeof pullRequestInboxSchema>;

export const syncPullRequestInboxRequestSchema = z
  .object({ project_id: z.string().min(1) })
  .strict();
export type SyncPullRequestInboxRequest = z.infer<typeof syncPullRequestInboxRequestSchema>;
