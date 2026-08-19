import { z } from "zod";

import { CONTEXT_NOTE_MAX_LENGTH } from "../context/limits.js";
import { contextReferencesSchema } from "../context/reference.js";
import { eventEnvelopeSchema } from "../events/envelope.js";
import { RUN_PLAN_STEP_NAME_MAX_LENGTH } from "../plan/limits.js";
import { runPlanInputSchema } from "../plan/validate.js";
import {
  agentSessionContractSchema,
  competeGroupContractSchema,
  runContractSchema,
  runContributionContractSchema,
  stepRunContractSchema,
} from "./entities/runs.js";
import { executionOptionSelectionsSchema } from "./execution-config.js";
import { modelSelectionSchema } from "./runtime-model.js";

/** Place in the daemon's FIFO wait line for a session slot, observed at one instant. */
export const runQueuePositionSchema = z.object({
  /** 1-based rank among the turns waiting for a slot; 1 is next to start. */
  position: z.number().int().positive(),
  active_sessions: z.number().int().nonnegative(),
  max_concurrent_sessions: z.number().int().positive(),
});
export type RunQueuePosition = z.infer<typeof runQueuePositionSchema>;

/** Why a run is making no progress right now, or null while one of its turns is live. */
export const runWaitSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("concurrency_limit"), ...runQueuePositionSchema.shape }),
  z.object({
    kind: z.literal("workflow_dependency"),
    /** Names of the plan nodes that must finish first, in plan order. */
    blocked_by: z.array(z.string()).min(1),
  }),
]);
export type RunWait = z.infer<typeof runWaitSchema>;

/** What **Resume run** would actually do, resolved before the user commits to it; a fallback is shown as itself, never behind one hopeful label. */
export const runResumePlanSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("native") }),
  z.object({ mode: z.literal("recovery"), reason: z.string() }),
  z.object({ mode: z.literal("next_step"), step_name: z.string() }),
  z.object({ mode: z.literal("unavailable"), reason: z.string() }),
]);
export type RunResumePlan = z.infer<typeof runResumePlanSchema>;

const UNKNOWN_RESUME_PLAN: RunResumePlan = {
  mode: "unavailable",
  reason: "This daemon does not report resume capability",
};

/** A run plus its persisted step/session graph; the event ledger is served by the run's SSE stream, not here. `worktree_path` and `base_branch` are null only on runs recorded before a worktree was guaranteed. */
export const runDetailSchema = z.object({
  run: runContractSchema,
  steps: z.array(stepRunContractSchema),
  sessions: z.array(agentSessionContractSchema),
  compete_groups: z.array(competeGroupContractSchema),
  worktree_path: z.string().nullable(),
  /** Branch the run's worktree forked from. */
  base_branch: z.string().nullable(),
  /** Live scheduler view, defaulted so a daemon deployed before the field existed still parses. */
  wait: runWaitSchema.nullable().default(null),
  /** Defaulted for the same reason as `wait`: an older daemon reports no resume capability rather than a false one. */
  resume: runResumePlanSchema.default(UNKNOWN_RESUME_PLAN),
  /** Whether this run still owns its issue's canonical workspace, so it can take a new step or be abandoned. Defaults false: a daemon that cannot answer must not have an action offered on its behalf. */
  holds_workspace: z.boolean().default(false),
});
export type RunDetail = z.infer<typeof runDetailSchema>;

/** A launch answers once the run and its frozen plan are durable; `wait` is set when no slot was taken yet. */
export const runLaunchResponseSchema = z.object({
  run: runContractSchema,
  wait: runWaitSchema.nullable(),
});
export type RunLaunchResponse = z.infer<typeof runLaunchResponseSchema>;

/** Why a launch was refused before any run row was written; every code is caller-fixable. */
export const RUN_LAUNCH_ERRORS = [
  "project_not_found",
  "project_mismatch",
  "repository_required",
  "repository_unavailable",
  "base_branch_not_found",
  "worktree_unavailable",
  "issue_workspace_open",
] as const;
export type RunLaunchError = (typeof RUN_LAUNCH_ERRORS)[number];

/** Stable refusal code plus a user-facing daemon message. `run_id` names the workspace holder on `issue_workspace_open`. */
export const runLaunchErrorSchema = z.object({
  error: z.enum(RUN_LAUNCH_ERRORS),
  message: z.string(),
  run_id: z.string().min(1).nullable().default(null),
});

/** Launch from an issue or an ad-hoc prompt (one required); an optional `plan` replaces the implicit single step. */
export const startRunRequestSchema = z
  .object({
    issue_id: z.string().min(1).optional(),
    /** Ad-hoc launch text; it becomes the local issue this run works on, never a step instruction of its own. */
    prompt: z.string().min(1).optional(),
    /** The one instruction the implicit single step adds to its attached context; ignored when `plan` is given. */
    note: z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH).optional(),
    /** Extra issues and repository files the implicit single step attaches; ignored when `plan` is given. */
    context: contextReferencesSchema.optional(),
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
    /** Per-launch provider options applied to every node that inherits this agent; an absent key keeps what the resolved agent carries. */
    options: executionOptionSelectionsSchema.optional(),
    plan: runPlanInputSchema.optional(),
  })
  .refine((value) => Boolean(value.issue_id) || Boolean(value.prompt), {
    message: "Provide either issue_id or prompt",
  });
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;

/** Append one step to a launched run's plan. The agent is chosen explicitly here — an appended step never inherits the last session's config. */
export const appendRunStepRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH),
    /** The one instruction this step adds; absent sends the attached context and the profile's guidance alone. */
    note: z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH).optional(),
    /** Extra issues and repository files to attach; the run's own issue is always attached. */
    context: contextReferencesSchema.optional(),
    /** Agent profile to resolve and freeze for this step; takes precedence over `runtime`. */
    profile_id: z.string().min(1).optional(),
    /** Ad-hoc runtime adapter id, used when no profile is selected. */
    runtime: z.string().min(1).optional(),
    /** Model override for this step alone; absent inherits the model of the config it resolves to. */
    model: modelSelectionSchema.optional(),
    /** Provider options for this step alone; an absent key keeps what the config it resolves to carries. */
    options: executionOptionSelectionsSchema.optional(),
    /** Existing plan node ids this step waits on; an empty list runs it as soon as the workspace is free. */
    depends_on: z.array(z.string().min(1)).default([]),
    /** Halted step this one recovers; once it succeeds, that failure stops holding the run in `failed`. */
    replaces: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.profile_id) || Boolean(value.runtime), {
    message: "Provide either profile_id or runtime",
  });
export type AppendRunStepRequest = z.infer<typeof appendRunStepRequestSchema>;

/** Why a resume was refused. Both are caller-fixable, and the daemon's own sentence says which precondition failed. */
export const RUN_RESUME_ERRORS = ["run_not_resumable", "issue_closed"] as const;

export const runResumeErrorSchema = z.object({
  error: z.enum(RUN_RESUME_ERRORS),
  message: z.string(),
});

/** Why a step could not be appended. `workspace_closed` and `issue_closed` are the merge guard; `invalid_revision` is a plan the append would have broken. */
export const RUN_STEP_APPEND_ERRORS = [
  "workspace_closed",
  "issue_closed",
  "invalid_revision",
] as const;

export const runStepAppendErrorSchema = z.object({
  error: z.enum(RUN_STEP_APPEND_ERRORS),
  message: z.string(),
});

/** Set or clear when a step waiting on a provider quota resumes; `null` cancels the schedule and leaves the step waiting and actionable. */
export const scheduleProviderResumeRequestSchema = z
  .object({ resume_at: z.iso.datetime().nullable() })
  .strict();
export type ScheduleProviderResumeRequest = z.infer<typeof scheduleProviderResumeRequestSchema>;

/** Why a resume schedule was refused. Both are caller-fixable: the run is not waiting, or the instant has already passed. */
export const PROVIDER_RESUME_SCHEDULE_ERRORS = ["run_not_waiting", "resume_at_passed"] as const;
export type ProviderResumeScheduleError = (typeof PROVIDER_RESUME_SCHEDULE_ERRORS)[number];

export const providerResumeScheduleErrorSchema = z.object({
  error: z.enum(PROVIDER_RESUME_SCHEDULE_ERRORS),
  message: z.string(),
});

/** Post one user message to a step's conversation; it is persisted as `queued` whatever the run is doing. */
export const createRunContributionRequestSchema = z
  .object({ step_run_id: z.string().min(1), body: z.string().trim().min(1) })
  .strict();
export type CreateRunContributionRequest = z.infer<typeof createRunContributionRequestSchema>;

/** A run's conversation contributions, oldest first. */
export const runContributionsResponseSchema = z.object({
  run_id: z.string(),
  contributions: z.array(runContributionContractSchema),
});
export type RunContributionsResponse = z.infer<typeof runContributionsResponseSchema>;

/** One bounded page of a run's ledger, ascending by `seq`; without a cursor it is the newest page. */
export const runEventWindowSchema = z.object({
  run_id: z.string(),
  events: z.array(eventEnvelopeSchema),
  /** Pass as `before` to read the page just above this one; null once the ledger's start is loaded. */
  older_cursor: z.number().int().nonnegative().nullable(),
});
export type RunEventWindow = z.infer<typeof runEventWindowSchema>;

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
