import { z } from "zod";

import { refinePlanGraph } from "./graph.js";
import { RUN_PLAN_MAX_STEPS } from "./limits.js";
import { runPlanNodeInputSchema } from "./node-input.js";

/** Strict launch-time schema; the persisted `runPlanSchema` stays the lenient mirror of what launch already validated. */
export const runPlanInputSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(runPlanNodeInputSchema).min(1).max(RUN_PLAN_MAX_STEPS),
  })
  .strict()
  .superRefine((plan, ctx) => refinePlanGraph(plan.steps, ctx));
export type RunPlanInput = z.infer<typeof runPlanInputSchema>;
