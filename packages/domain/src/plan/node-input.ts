import { z } from "zod";

import { CONTEXT_NOTE_MAX_LENGTH } from "../context/limits.js";
import { contextReferencesSchema } from "../context/reference.js";
import { executionOptionSelectionsSchema } from "../contracts/execution-config.js";
import { modelSelectionSchema } from "../contracts/runtime-model.js";
import {
  RUN_PLAN_MAX_STEPS,
  RUN_PLAN_STEP_ID_PATTERN,
  RUN_PLAN_STEP_NAME_MAX_LENGTH,
} from "./limits.js";

export const planNodeIdSchema = z
  .string()
  .regex(RUN_PLAN_STEP_ID_PATTERN, "Step ids are lowercase alphanumerics and dashes, 64 chars max");
/** A label for the reader; the daemon never turns it into an instruction. */
export const planNodeNameSchema = z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH);
const planNodeNoteSchema = z.string().trim().min(1).max(CONTEXT_NOTE_MAX_LENGTH);
export const planDependenciesSchema = z.array(z.string()).max(RUN_PLAN_MAX_STEPS - 1);

/** What an executable node carries on its own, before a launch attaches context to it. */
export const planNodeTemplateShape = {
  /** Runtime adapter id for this node; null inherits the run's default runtime. */
  agent: z.string().min(1).nullable(),
  /** Agent profile to resolve and freeze for this node; takes precedence over `agent`. Null/absent keeps the ad-hoc runtime path. */
  profile_id: z.string().min(1).nullish(),
  /** Model override for this node alone; absent inherits the model of whatever config it resolves to. */
  model: modelSelectionSchema.optional(),
  /** Provider options for this node alone; an absent key inherits the launch's, `agent_default` keeps the resolved agent's own. */
  options: executionOptionSelectionsSchema.optional(),
  /** The one instruction this node adds; absent sends the attached context and the profile's guidance alone. */
  note: planNodeNoteSchema.optional(),
};

/** The execution choices every executable node accepts; a node that names none inherits the launch's. */
const planNodeExecutionShape = {
  ...planNodeTemplateShape,
  /** Extra issues and repository files to attach; the run's own issue is always attached. */
  context: contextReferencesSchema.optional(),
};

export const runPlanStepInputSchema = z
  .object({
    id: planNodeIdSchema,
    name: planNodeNameSchema,
    ...planNodeExecutionShape,
    depends_on: planDependenciesSchema,
  })
  .strict();
export type RunPlanStepInput = z.infer<typeof runPlanStepInputSchema>;

const runPlanCompetitorInputSchema = z
  .object({ id: planNodeIdSchema, name: planNodeNameSchema, ...planNodeExecutionShape })
  .strict();
const runPlanCompeteGroupInputSchema = z
  .object({
    id: planNodeIdSchema,
    /** Shared objective pursued by every competitor. */
    name: planNodeNameSchema,
    depends_on: planDependenciesSchema,
    compete: z
      .array(runPlanCompetitorInputSchema)
      .min(2, "Compete groups require at least two competitors")
      .max(RUN_PLAN_MAX_STEPS),
  })
  .strict();
export const runPlanNodeInputSchema = z.union([
  runPlanStepInputSchema,
  runPlanCompeteGroupInputSchema,
]);
export type RunPlanNodeInput = z.infer<typeof runPlanNodeInputSchema>;
