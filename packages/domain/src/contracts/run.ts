import { z } from "zod";

import { runPlanInputSchema } from "../plan/validate.js";
import {
  agentSessionContractSchema,
  competeGroupContractSchema,
  runContractSchema,
  runContributionContractSchema,
  stepRunContractSchema,
} from "./entities/runs.js";

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. `worktree_path` is null when the run has no worktree. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
  compete_groups: z.array(competeGroupContractSchema),
  worktree_path: z.string().nullable(),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** Launch from an issue or an ad-hoc prompt (one required); an optional `plan` replaces the implicit single step. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    /** Project for an ad-hoc run and its anchor issue; ignored when `issue_id` already pins it. */
    project_id: z.string().min(1).optional(),
    /** Runtime adapter id; the daemon validates it against its registry and rejects unavailable runtimes. Steps may override it per step via `plan.steps[].agent`. */
    runtime: z.string().min(1).optional(),
    /** Agent profile resolved and frozen for the run default; per-node `profile_id` overrides it. Takes precedence over `runtime`. */
    profile_id: z.string().min(1).optional(),
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
