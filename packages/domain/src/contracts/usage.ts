import { z } from "zod";

import { USAGE_AVAILABILITIES } from "../projections/usage.js";
import { STEP_RUN_STATES } from "./entity-states.js";

/** Kept with its provenance: nothing here is estimated, and an absent field is never rendered as a zero. */
export const reportedUsageSchema = z
  .object({
    availability: z.enum(USAGE_AVAILABILITIES),
    input_tokens: z.number().int().nonnegative().nullable(),
    output_tokens: z.number().int().nonnegative().nullable(),
    cost_usd: z.number().nonnegative().nullable(),
    turns: z.number().int().nonnegative(),
  })
  .strict();
export type ReportedUsageContract = z.infer<typeof reportedUsageSchema>;

export const runUsageStepSchema = z
  .object({
    step_run_id: z.string(),
    name: z.string().min(1),
    status: z.enum(STEP_RUN_STATES),
    usage: reportedUsageSchema,
  })
  .strict();
export type RunUsageStep = z.infer<typeof runUsageStepSchema>;

/** A run's usage read from the whole ledger — never summed from the page the cockpit happens to have loaded. */
export const runUsageResponseSchema = z
  .object({
    run_id: z.string(),
    total: reportedUsageSchema,
    steps: z.array(runUsageStepSchema),
  })
  .strict();
export type RunUsageResponse = z.infer<typeof runUsageResponseSchema>;
