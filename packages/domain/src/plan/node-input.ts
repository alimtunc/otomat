import { z } from "zod";

import { effortSelectionSchema } from "../contracts/provider-options.js";
import { modelSelectionSchema } from "../contracts/runtime-model.js";
import {
  RUN_PLAN_MAX_STEPS,
  RUN_PLAN_STEP_ID_PATTERN,
  RUN_PLAN_STEP_NAME_MAX_LENGTH,
  RUN_PLAN_STEP_PROMPT_MAX_LENGTH,
} from "./limits.js";

const planNodeIdSchema = z
  .string()
  .regex(RUN_PLAN_STEP_ID_PATTERN, "Step ids are lowercase alphanumerics and dashes, 64 chars max");
const planNodeNameSchema = z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH);
const planNodePromptSchema = z.string().trim().min(1).max(RUN_PLAN_STEP_PROMPT_MAX_LENGTH);
const planDependenciesSchema = z.array(z.string()).max(RUN_PLAN_MAX_STEPS - 1);

export const runPlanStepInputSchema = z
  .object({
    id: planNodeIdSchema,
    name: planNodeNameSchema,
    /** Runtime adapter id for this step; null inherits the run's default runtime. */
    agent: z.string().min(1).nullable(),
    /** Agent profile to resolve and freeze for this step; takes precedence over `agent`. Null/absent keeps the ad-hoc runtime path. */
    profile_id: z.string().min(1).nullish(),
    /** Model override for this step alone; absent inherits the model of whatever config this step resolves to. */
    model: modelSelectionSchema.optional(),
    /** Effort for this step alone; absent inherits the launch's, `agent_default` keeps the resolved agent's own. */
    effort: effortSelectionSchema.optional(),
    prompt: planNodePromptSchema,
    depends_on: planDependenciesSchema,
  })
  .strict();
export type RunPlanStepInput = z.infer<typeof runPlanStepInputSchema>;

const runPlanCompetitorInputSchema = z
  .object({
    id: planNodeIdSchema,
    name: planNodeNameSchema,
    agent: z.string().min(1).nullable(),
    /** Agent profile to resolve and freeze for this candidate; takes precedence over `agent`. */
    profile_id: z.string().min(1).nullish(),
    /** Model override for this candidate alone; absent inherits the model of whatever config it resolves to. */
    model: modelSelectionSchema.optional(),
    /** Effort for this candidate alone; absent inherits the launch's, `agent_default` keeps the resolved agent's own. */
    effort: effortSelectionSchema.optional(),
    prompt: planNodePromptSchema,
  })
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
