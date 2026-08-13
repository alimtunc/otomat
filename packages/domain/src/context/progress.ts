import { z } from "zod";

import { STEP_RUN_STATES } from "../contracts/entity-states.js";

export const contextPlanStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(STEP_RUN_STATES),
  /** True for the step this session runs. */
  current: z.boolean(),
  /** True when this session's step waits on it, so its output is the handover. */
  dependency: z.boolean(),
  report: z.string().nullable(),
});

export const contextProgressSchema = z.object({
  step_name: z.string(),
  steps: z.array(contextPlanStepSchema),
});
export type ContextProgress = z.infer<typeof contextProgressSchema>;
