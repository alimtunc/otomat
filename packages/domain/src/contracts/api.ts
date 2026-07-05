import { z } from "zod";

import {
  agentSessionContractSchema,
  pullRequestContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  stepRunContractSchema,
} from "./entities.js";

/** Daemon liveness/identity surface served at `GET /api/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  name: z.string(),
  version: z.string(),
  started_at: z.iso.datetime(),
  db_path: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** Launch a run from an existing issue or from an ad-hoc local prompt. At least one is required. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** A run's review surface: the review row (null before the first comment) plus every comment, newest last. */
export const reviewDetailSchema = z.object({
  review: reviewContractSchema.nullable(),
  comments: z.array(reviewCommentContractSchema),
});
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

/** Create a comment pinned to the diff the reviewer is looking at; the daemon verifies the anchor. */
export const createReviewCommentRequestSchema = z.object({
  file_path: z.string().min(1),
  line: z.number().int().nonnegative(),
  diff_sha: z.string().min(1),
  body: z.string().min(1),
});
export type CreateReviewCommentRequest = z.infer<typeof createReviewCommentRequestSchema>;

/** Ask an agent to fix the selected open comments as a follow-up turn on the same run. */
export const requestFixRequestSchema = z.object({
  comment_ids: z.array(z.string().min(1)).min(1),
});
export type RequestFixRequest = z.infer<typeof requestFixRequestSchema>;

/** Persist the local PR draft (stub — nothing is sent to a provider). */
export const preparePullRequestRequestSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
});
export type PreparePullRequestRequest = z.infer<typeof preparePullRequestRequestSchema>;

/** `pull_request` is null while no PR has been prepared for the run. */
export const pullRequestDetailSchema = z.object({
  pull_request: pullRequestContractSchema.nullable(),
});
export type PullRequestDetail = z.infer<typeof pullRequestDetailSchema>;

/** Terminal payload of a run's SSE stream: the run's final status once the ledger is drained. */
export const runEndPayloadSchema = z.object({ status: z.string() });
export type RunEndPayload = z.infer<typeof runEndPayloadSchema>;

/** Terminal payload when a run's SSE stream fails server-side before the run ends; the consumer should stop and surface it. */
export const runStreamErrorPayloadSchema = z.object({ message: z.string() });
export type RunStreamErrorPayload = z.infer<typeof runStreamErrorPayloadSchema>;
