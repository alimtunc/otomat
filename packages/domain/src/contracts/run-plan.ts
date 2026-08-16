import { z } from "zod";

import { contextSelectionSchema } from "../context/selection.js";
import { resolvedAgentConfigSchema } from "./entities/agents.js";

const runPlanExecutableShape = {
  id: z.string(),
  name: z.string().min(1),
  agent: z.string().nullable(),
  /** The hand-composed prompt runs launched before the declarative model froze; null on every node since. */
  prompt: z.string().nullable(),
  /** Frozen at launch, but left out of the API's plan: a session's dossier is where a reader asks for its content. */
  context: contextSelectionSchema.nullish(),
  config: resolvedAgentConfigSchema.nullish(),
};

/** One unit of agent work inside a frozen run plan. */
export const runPlanStepSchema = z.object({
  ...runPlanExecutableShape,
  depends_on: z.array(z.string()),
  /** Halted step this one was appended to recover; its outcome then reads through to this step. Null on every node frozen at launch. */
  replaces: z.string().nullish(),
});
export type RunPlanStep = z.infer<typeof runPlanStepSchema>;

/** One executable candidate inside a compete group. Dependencies belong to the group. */
export const runPlanCompetitorSchema = z.object(runPlanExecutableShape);
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

/** Generic over the node union so a launch input and a frozen plan node are both narrowed by the one guard. */
export function isRunPlanCompeteGroup<T>(
  node: T,
): node is Extract<T, { compete: readonly unknown[] }> {
  return typeof node === "object" && node !== null && "compete" in node;
}

/** `runs.plan_json` — frozen at launch, then append-only: a revision may add a node, never rewrite or drop one. */
export const runPlanSchema = z.object({
  version: z.literal(1),
  steps: z.array(runPlanNodeSchema),
});
export type RunPlan = z.infer<typeof runPlanSchema>;
