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

/** Wire id of the built-in deterministic fake runtime — the default when a launch request omits `runtime`. */
export const FAKE_RUNTIME_ID = "fake";

/** Launch a run from an existing issue or from an ad-hoc local prompt. At least one is required. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    /** Runtime adapter id; the daemon validates it against its registry and defaults to the fake runtime. */
    runtime: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** Optional behaviors a runtime may advertise; absent ones degrade silently in the UI. Single source for the daemon registry and the wire contract. */
export const runtimeCapabilitiesSchema = z.object({
  stream: z.boolean(),
  /** Follow-up between turns via `resume`, never mid-turn steering. */
  send_message: z.boolean(),
  abort: z.boolean(),
  resume: z.boolean(),
  permissions: z.boolean(),
  diff_hints: z.boolean(),
});
export type RuntimeCapabilities = z.infer<typeof runtimeCapabilitiesSchema>;

/** One runtime adapter as reported by the daemon: identity plus its honest capability set. */
export const runtimeDescriptorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  capabilities: runtimeCapabilitiesSchema,
});
export type RuntimeDescriptor = z.infer<typeof runtimeDescriptorSchema>;

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
