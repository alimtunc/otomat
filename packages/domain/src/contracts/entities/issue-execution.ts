import { z } from "zod";

import type { IssueState } from "../entity-states.js";

/** What Otomat is locally doing for an issue — never the issue's business/source `status`, which a run, review, or PR must not mutate. */
export const ISSUE_EXECUTION_STATES = [
  "running",
  "waiting_for_provider",
  "reviewing",
  "pr_open",
  "failed",
  "none",
] as const;
export type IssueExecutionState = (typeof ISSUE_EXECUTION_STATES)[number];

/**
 * Where an issue is shown once its local execution is taken into account: its
 * source status, plus the `failed` and `waiting_for_provider` executions that
 * must never fold back into `ready`. Ordered as the board reads, left to right.
 */
export const ISSUE_BOARD_COLUMNS = [
  "backlog",
  "ready",
  "running",
  "waiting_for_provider",
  "failed",
  "reviewing",
  "pr_open",
  "blocked",
  "done",
  "canceled",
] as const satisfies readonly (IssueState | Exclude<IssueExecutionState, "none">)[];
export type IssueBoardColumn = (typeof ISSUE_BOARD_COLUMNS)[number];

/** Why the issue's open workspace stopped; every one of them is resumable, so none closes the cycle. */
export const ISSUE_EXECUTION_FAILURE_REASONS = ["failed", "canceled", "interrupted"] as const;
export type IssueExecutionFailureReason = (typeof ISSUE_EXECUTION_FAILURE_REASONS)[number];

const issueExecutionFailureSchema = z.object({
  reason: z.enum(ISSUE_EXECUTION_FAILURE_REASONS),
  /** Last step of the holding run that failed or went stale; null when the run stopped before any step did. */
  step: z.object({ id: z.string().min(1), name: z.string().min(1) }).nullable(),
});
export type IssueExecutionFailure = z.infer<typeof issueExecutionFailureSchema>;

const activeExecutionSchema = z.object({
  state: z.enum(["running", "waiting_for_provider", "reviewing", "pr_open"]),
  run_id: z.string().min(1),
});
const failedExecutionSchema = z.object({
  state: z.literal("failed"),
  run_id: z.string().min(1),
  failure: issueExecutionFailureSchema,
});
const noExecutionSchema = z.object({ state: z.literal("none"), run_id: z.null() });

/** A projected state always names its run; `none` always has no run. The illegal in-between cannot be represented. */
export const issueExecutionSchema = z.union([
  activeExecutionSchema,
  failedExecutionSchema,
  noExecutionSchema,
]);
export type IssueExecution = z.infer<typeof issueExecutionSchema>;
