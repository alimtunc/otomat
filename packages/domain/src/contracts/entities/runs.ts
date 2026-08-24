import { z } from "zod";

import {
  AGENT_SESSION_STATES,
  COMPETE_GROUP_STATES,
  RUN_CONTRIBUTION_STATES,
  RUN_INTERACTION_KINDS,
  RUN_INTERACTION_STATES,
  RUN_STATES,
  STEP_RUN_STATES,
} from "../entity-states.js";
import { runPlanSchema } from "../run-plan.js";
import { runtimeInteractionAnswerSchema, runtimeInteractionOptionSchema } from "../runtime.js";
import { resolvedAgentConfigSchema } from "./agents.js";
import { worktreeStatusSchema } from "./workspace.js";

export const runContractSchema = z.object({
  id: z.string(),
  issue_id: z.string(),
  status: z.enum(RUN_STATES),
  branch: z.string(),
  plan_json: runPlanSchema,
  /** Last time the daemon wrote this run row; the honest "last activity" of a collapsed run. */
  updated_at: z.iso.datetime(),
});
export type RunContract = z.infer<typeof runContractSchema>;

/** `status` is the delivery lifecycle, never a read receipt. */
export const runContributionContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_run_id: z.string(),
  /** FIFO position within the run; a batched turn carries its messages in ascending order. */
  seq: z.number().int().nonnegative(),
  body: z.string().min(1),
  status: z.enum(RUN_CONTRIBUTION_STATES),
  /** Agent session the delivering turn resumes; stamped when the delivery is claimed. */
  agent_session_id: z.string().nullable(),
  target_agent_session_id: z.string().nullable(),
  target_config: resolvedAgentConfigSchema.nullable(),
  delivered_at: z.iso.datetime().nullable(),
  /** When the carrying turn settled, resolving this message to `acknowledged` or `failed`. */
  settled_at: z.iso.datetime().nullable(),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  created_at: z.iso.datetime(),
});
export type RunContributionContract = z.infer<typeof runContributionContractSchema>;

/** One question a runtime blocked its turn on, and what the operator answered. */
export const runInteractionContractSchema = z.object({
  /** The id of the `runtime.interaction_requested` event that asked it, so a surface can place the request where it was asked. */
  id: z.string(),
  run_id: z.string(),
  step_run_id: z.string(),
  agent_session_id: z.string(),
  provider_request_id: z.string(),
  kind: z.enum(RUN_INTERACTION_KINDS),
  state: z.enum(RUN_INTERACTION_STATES),
  prompt: z.string().min(1),
  tool: z.string().nullable(),
  options: z.array(runtimeInteractionOptionSchema),
  answer: runtimeInteractionAnswerSchema.nullable(),
  /** Why the request can no longer be answered; set only on `canceled`. */
  canceled_reason: z.string().nullable(),
  requested_at: z.iso.datetime(),
  settled_at: z.iso.datetime().nullable(),
});
export type RunInteractionContract = z.infer<typeof runInteractionContractSchema>;

/**
 * A step suspended on a provider quota: the limit as the provider reported it, plus
 * the resume it is scheduled for. `resume_at` null is an actionable wait, not a lost
 * one — the provider proved no deadline, or the operator cancelled the schedule.
 */
export const stepProviderWaitSchema = z.object({
  provider: z.string().min(1),
  reason: z.string().min(1),
  detected_at: z.iso.datetime(),
  /** The reset the provider proved, kept through every reschedule: it is evidence, not a setting. */
  provider_resume_at: z.iso.datetime().nullable(),
  /** When the daemon will resume the step; null while nothing is scheduled. */
  resume_at: z.iso.datetime().nullable(),
});
export type StepProviderWait = z.infer<typeof stepProviderWaitSchema>;

/** Whether the scheduled instant is the provider's own reset rather than a time the operator picked. */
export function isProviderProvedResume(wait: StepProviderWait): boolean {
  return wait.resume_at !== null && wait.resume_at === wait.provider_resume_at;
}

export const stepRunContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  /** Zero-based position of this step within the run. */
  idx: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.enum(STEP_RUN_STATES),
  compete_group_id: z.string().nullable(),
  worktree_id: z.string().nullable(),
  branch: z.string().nullable(),
  worktree_status: worktreeStatusSchema.nullable(),
  /** Set only while the step is `waiting_for_provider`. */
  provider_wait: stepProviderWaitSchema.nullable(),
  next_turn_config: resolvedAgentConfigSchema.nullable(),
});
export type StepRunContract = z.infer<typeof stepRunContractSchema>;

export const competeGroupContractSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  idx: z.number().int().nonnegative(),
  name: z.string().min(1),
  status: z.enum(COMPETE_GROUP_STATES),
  winner_step_run_id: z.string().nullable(),
  base_head_sha: z.string().nullable(),
});
export type CompeteGroupContract = z.infer<typeof competeGroupContractSchema>;

/** Diffing the two trees reconstructs what the pass did, and stays true after later passes because a tree object never moves. */
export const sessionPassBoundarySchema = z.object({
  start_tree_sha: z.string().nullable(),
  start_head_sha: z.string().nullable(),
  end_tree_sha: z.string().nullable(),
  end_head_sha: z.string().nullable(),
  error: z.string().nullable(),
});
export type SessionPassBoundary = z.infer<typeof sessionPassBoundarySchema>;

export const agentSessionContractSchema = z.object({
  id: z.string(),
  step_run_id: z.string(),
  agent_id: z.string().nullable(),
  status: z.enum(AGENT_SESSION_STATES),
  /** Provider session id, reused when resuming after the runtime assigns it. */
  provider_session_id: z.string().nullable(),
  resumed_from_session_id: z.string().nullable(),
  config: resolvedAgentConfigSchema.nullable(),
  reported_model: z.string().nullable(),
  started_at: z.iso.datetime().nullable(),
  boundary: sessionPassBoundarySchema,
});
export type AgentSessionContract = z.infer<typeof agentSessionContractSchema>;

export interface StepPassBounds {
  start_tree_sha: string;
  end_tree_sha: string;
}

/** Read positionally, so `boundaries` must be in turn order; null rather than a narrower span, since the workspace is not a stand-in for a missing exit. */
export function stepPassBounds(
  boundaries: readonly Pick<SessionPassBoundary, "start_tree_sha" | "end_tree_sha">[],
): StepPassBounds | null {
  const start = boundaries[0]?.start_tree_sha ?? null;
  const end = boundaries.at(-1)?.end_tree_sha ?? null;
  if (start === null || end === null) return null;
  return { start_tree_sha: start, end_tree_sha: end };
}
