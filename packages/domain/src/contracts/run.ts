import { z } from "zod";

import { runPlanInputSchema } from "../plan/validate.js";
import {
  agentSessionContractSchema,
  competeGroupContractSchema,
  runContractSchema,
  runContributionContractSchema,
  stepRunContractSchema,
} from "./entities/runs.js";
import { providerOptionValueSchema } from "./provider-options.js";
import { modelSelectionSchema } from "./runtime-model.js";

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. `worktree_path` and `base_branch` are null only on runs recorded before a worktree was guaranteed. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
  compete_groups: z.array(competeGroupContractSchema),
  worktree_path: z.string().nullable(),
  /** Branch the run's worktree forked from. */
  base_branch: z.string().nullable(),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** Why a launch was refused before any run row was written; every code is caller-fixable. */
export const RUN_LAUNCH_ERRORS = [
  "project_not_found",
  "project_mismatch",
  "repository_required",
  "repository_unavailable",
  "base_branch_not_found",
  "worktree_unavailable",
] as const;
export type RunLaunchError = (typeof RUN_LAUNCH_ERRORS)[number];

/** Stable refusal code plus a user-facing daemon message. */
export const runLaunchErrorSchema = z.object({
  error: z.enum(RUN_LAUNCH_ERRORS),
  message: z.string(),
});

/** Launch from an issue or an ad-hoc prompt (one required); an optional `plan` replaces the implicit single step. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    /** Project the run executes in; an ad-hoc run without one uses the daemon's boot project. With `issue_id` it must match the issue's project. */
    project_id: z.string().min(1).optional(),
    /** Branch the run's dedicated worktree forks from; absent uses the repository's default branch. */
    base_branch: z.string().trim().min(1).optional(),
    /** Runtime adapter id; the daemon validates it against its registry and rejects unavailable runtimes. Steps may override it per step via `plan.steps[].agent`. */
    runtime: z.string().min(1).optional(),
    /** Agent profile resolved and frozen for the run default; per-node `profile_id` overrides it. Takes precedence over `runtime`. */
    profile_id: z.string().min(1).optional(),
    /** Per-launch model override for the run default config; absent inherits the profile's model. */
    model: modelSelectionSchema.optional(),
    /** Per-launch effort level applied to every node that inherits it; absent keeps the effort each resolved agent carries. */
    effort: providerOptionValueSchema.optional(),
    plan: runPlanInputSchema.optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** Post one user message to a run's conversation; it is persisted as `queued` whatever the run is doing. */
export const createRunContributionRequestSchema = z
  .object({ body: z.string().trim().min(1) })
  .strict();
export type CreateRunContributionRequest = z.infer<typeof createRunContributionRequestSchema>;

/** A run's conversation contributions, oldest first. */
export const runContributionsResponseSchema = z.object({
  run_id: z.string(),
  contributions: z.array(runContributionContractSchema),
});
export type RunContributionsResponse = z.infer<typeof runContributionsResponseSchema>;

/** Select one succeeded competitor explicitly; the daemon rejects premature or conflicting choices. */
export const selectCompeteWinnerRequestSchema = z
  .object({ step_run_id: z.string().min(1) })
  .strict();
export type SelectCompeteWinnerRequest = z.infer<typeof selectCompeteWinnerRequestSchema>;

/** Terminal payload of a run's SSE stream: the run's final status once the ledger is drained. */
export const runEndPayloadSchema = z.object({ status: z.string() });
export type RunEndPayload = z.infer<typeof runEndPayloadSchema>;

/** Terminal payload when a run's SSE stream fails server-side before the run ends; the consumer should stop and surface it. */
export const runStreamErrorPayloadSchema = z.object({ message: z.string() });
export type RunStreamErrorPayload = z.infer<typeof runStreamErrorPayloadSchema>;
