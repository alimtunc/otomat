import { z } from "zod";

import { runPlanInputSchema } from "../plan/validate.js";
import {
  agentSessionContractSchema,
  projectContractSchema,
  pullRequestContractSchema,
  repositoryContractSchema,
  reviewCommentContractSchema,
  reviewContractSchema,
  runContractSchema,
  stepRunContractSchema,
} from "./entities.js";

export const GITHUB_CONNECTION_STATES = [
  "not_installed",
  "disconnected",
  "connecting",
  "connected",
  "failed",
] as const;

export const githubConnectionContractSchema = z.object({
  status: z.enum(GITHUB_CONNECTION_STATES),
  login: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
});
export type GitHubConnectionContract = z.infer<typeof githubConnectionContractSchema>;

/** Daemon liveness/identity surface served at `GET /api/health`. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  name: z.string(),
  version: z.string(),
  started_at: z.iso.datetime(),
  db_path: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. `worktree_path` is null when the run has no worktree. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
  worktree_path: z.string().nullable(),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** Wire id of the built-in deterministic fake runtime — a simulated runtime for tests and explicit development only. */
export const FAKE_RUNTIME_ID = "fake";

/** Launch from an issue or an ad-hoc prompt (one required); an optional `plan` replaces the implicit single step. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    /** Project for an ad-hoc run and its anchor issue; ignored when `issue_id` already pins it. */
    project_id: z.string().min(1).optional(),
    /** Runtime adapter id; the daemon validates it against its registry and rejects unavailable runtimes. Steps may override it per step via `plan.steps[].agent`. */
    runtime: z.string().min(1).optional(),
    plan: runPlanInputSchema.optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** Why a local path was refused as a repository registration; safe to show verbatim in the UI. */
export const REPOSITORY_REGISTRATION_ERRORS = [
  "path_not_absolute",
  "path_not_found",
  "path_not_directory",
  "path_not_git_repository",
  "path_not_repository_root",
  "head_detached",
  "default_branch_undetectable",
  "repository_already_registered",
] as const;
export type RepositoryRegistrationError = (typeof REPOSITORY_REGISTRATION_ERRORS)[number];

/** Local filesystem path submitted for repository registration. */
export const registerRepositoryRequestSchema = z.object({
  path: z.string().trim().min(1),
});
export type RegisterRepositoryRequest = z.infer<typeof registerRepositoryRequestSchema>;

/** Successful registration materializes both the project and its repository. */
export const registerRepositoryResponseSchema = z.object({
  project: projectContractSchema,
  repository: repositoryContractSchema,
});

/** Stable refusal code plus a user-facing daemon message. */
export const repositoryRegistrationErrorSchema = z.object({
  error: z.enum(REPOSITORY_REGISTRATION_ERRORS),
  message: z.string(),
});

/** Create a local issue without launching a run. */
export const createIssueRequestSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;

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

/** Why a runtime cannot be used right now; safe to show verbatim in the UI. */
export const RUNTIME_UNAVAILABLE_REASONS = ["binary_not_found", "not_enabled"] as const;
export type RuntimeUnavailableReason = (typeof RUNTIME_UNAVAILABLE_REASONS)[number];

/** Probed without launching the provider: `version` is null when no safe probe reports one. */
export const runtimeAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), version: z.string().nullable() }),
  z.object({ status: z.literal("unavailable"), reason: z.enum(RUNTIME_UNAVAILABLE_REASONS) }),
]);
export type RuntimeAvailability = z.infer<typeof runtimeAvailabilitySchema>;

/** `real` drives an installed provider CLI; `simulated` is the deterministic fake, never a normal user runtime. */
export const runtimeKindSchema = z.enum(["real", "simulated"]);
export type RuntimeKind = z.infer<typeof runtimeKindSchema>;

/** One runtime adapter as reported by the daemon: identity, honest capability set, and probed availability. */
export const runtimeDescriptorSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  kind: runtimeKindSchema,
  capabilities: runtimeCapabilitiesSchema,
  availability: runtimeAvailabilitySchema,
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

/** Send the user's own prompt as a follow-up turn resuming the run's existing provider session. */
export const followUpRunRequestSchema = z.object({
  prompt: z.string().trim().min(1),
});
export type FollowUpRunRequest = z.infer<typeof followUpRunRequestSchema>;

/** Publish or update the run's GitHub pull request. */
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
