import { z } from "zod";

/** Defaulted empty so an older daemon names no step, and nothing is offered as configuring the step it reopens. */
const reopenedStepRunIdsSchema = z.array(z.string()).default([]);

/** What **Resume run** would actually do, resolved before the user commits to it; a fallback is shown as itself, never behind one hopeful label. */
export const runResumePlanSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("native"), step_run_ids: reopenedStepRunIdsSchema }),
  z.object({
    mode: z.literal("recovery"),
    reason: z.string(),
    step_run_ids: reopenedStepRunIdsSchema,
  }),
  z.object({ mode: z.literal("next_step"), step_name: z.string() }),
  z.object({ mode: z.literal("unavailable"), reason: z.string() }),
]);
export type RunResumePlan = z.infer<typeof runResumePlanSchema>;

/** Why a resume was refused. Both are caller-fixable, and the daemon's own sentence says which precondition failed. */
export const RUN_RESUME_ERRORS = ["run_not_resumable", "issue_closed"] as const;

export const runResumeErrorSchema = z.object({
  error: z.enum(RUN_RESUME_ERRORS),
  message: z.string(),
});
