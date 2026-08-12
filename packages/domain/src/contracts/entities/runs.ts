import { z } from "zod";

import {
  AGENT_SESSION_STATES,
  COMPETE_GROUP_STATES,
  RUN_CONTRIBUTION_STATES,
  RUN_STATES,
  STEP_RUN_STATES,
} from "../entity-states.js";
import { resolvedAgentConfigSchema } from "./agents.js";
import { worktreeStatusSchema } from "./workspace.js";

/** One unit of agent work inside a frozen run plan. */
export const runPlanStepSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
  depends_on: z.array(z.string()),
  config: resolvedAgentConfigSchema.nullish(),
});
export type RunPlanStep = z.infer<typeof runPlanStepSchema>;

/** One executable candidate inside a compete group. Dependencies belong to the group. */
export const runPlanCompetitorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  prompt: z.string().nullable(),
  config: resolvedAgentConfigSchema.nullish(),
});
export type RunPlanCompetitor = z.infer<typeof runPlanCompetitorSchema>;

/** One dependency node whose candidates run in isolation until a user selects a winner. */
export const runPlanCompeteGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  depends_on: z.array(z.string()),
  compete: z.array(runPlanCompetitorSchema).min(2),
});
export type RunPlanCompeteGroup = z.infer<typeof runPlanCompeteGroupSchema>;

export const runPlanNodeSchema = z.union([runPlanStepSchema, runPlanCompeteGroupSchema]);
export type RunPlanNode = z.infer<typeof runPlanNodeSchema>;

export function isRunPlanCompeteGroup(node: RunPlanNode): node is RunPlanCompeteGroup {
  return "compete" in node;
}

/** `runs.plan_json` — frozen at launch, then append-only: a revision may add a node, never rewrite or drop one. */
export const runPlanSchema = z.object({
  version: z.literal(1),
  steps: z.array(runPlanNodeSchema),
});
export type RunPlan = z.infer<typeof runPlanSchema>;

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
  delivered_at: z.iso.datetime().nullable(),
  /** When the carrying turn settled, resolving this message to `acknowledged` or `failed`. */
  settled_at: z.iso.datetime().nullable(),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  created_at: z.iso.datetime(),
});
export type RunContributionContract = z.infer<typeof runContributionContractSchema>;

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

export const agentSessionContractSchema = z.object({
  id: z.string(),
  step_run_id: z.string(),
  agent_id: z.string().nullable(),
  status: z.enum(AGENT_SESSION_STATES),
  /** Provider session id, reused when resuming after the runtime assigns it. */
  provider_session_id: z.string().nullable(),
});
export type AgentSessionContract = z.infer<typeof agentSessionContractSchema>;
