import { z } from "zod";

import {
  RUN_PLAN_MAX_STEPS,
  RUN_PLAN_STEP_ID_PATTERN,
  RUN_PLAN_STEP_NAME_MAX_LENGTH,
  RUN_PLAN_STEP_PROMPT_MAX_LENGTH,
} from "./limits.js";
import { topologicalStepOrder } from "./schedule.js";

export const runPlanStepInputSchema = z.object({
  id: z
    .string()
    .regex(
      RUN_PLAN_STEP_ID_PATTERN,
      "Step ids are lowercase alphanumerics and dashes, 64 chars max",
    ),
  name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH),
  /** Runtime adapter id for this step; null inherits the run's default runtime. */
  agent: z.string().min(1).nullable(),
  prompt: z.string().trim().min(1).max(RUN_PLAN_STEP_PROMPT_MAX_LENGTH),
  depends_on: z.array(z.string()).max(RUN_PLAN_MAX_STEPS - 1),
});
export type RunPlanStepInput = z.infer<typeof runPlanStepInputSchema>;

function checkStepIds(
  steps: readonly RunPlanStepInput[],
  ctx: z.RefinementCtx,
): { ids: Set<string>; sound: boolean } {
  const ids = new Set<string>();
  let sound = true;
  steps.forEach((step, index) => {
    if (ids.has(step.id)) {
      sound = false;
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "id"],
        message: `Duplicate step id "${step.id}"`,
      });
    }
    ids.add(step.id);
  });
  return { ids, sound };
}

function checkDependencies(
  steps: readonly RunPlanStepInput[],
  ids: ReadonlySet<string>,
  ctx: z.RefinementCtx,
): boolean {
  let sound = true;
  steps.forEach((step, index) => {
    const seen = new Set<string>();
    step.depends_on.forEach((dependency, dependencyIndex) => {
      const path = ["steps", index, "depends_on", dependencyIndex];
      if (dependency === step.id) {
        sound = false;
        ctx.addIssue({
          code: "custom",
          path,
          message: `Step "${step.id}" cannot depend on itself`,
        });
      } else if (!ids.has(dependency)) {
        sound = false;
        ctx.addIssue({
          code: "custom",
          path,
          message: `Unknown dependency "${dependency}"`,
        });
      }
      if (seen.has(dependency)) {
        sound = false;
        ctx.addIssue({
          code: "custom",
          path,
          message: `Duplicate dependency "${dependency}"`,
        });
      }
      seen.add(dependency);
    });
  });
  return sound;
}

/** Strict launch-time schema; the persisted `runPlanSchema` stays the lenient mirror of what launch already validated. */
export const runPlanInputSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(runPlanStepInputSchema).min(1).max(RUN_PLAN_MAX_STEPS),
  })
  .superRefine((plan, ctx) => {
    const { ids, sound: idsSound } = checkStepIds(plan.steps, ctx);
    const depsSound = checkDependencies(plan.steps, ids, ctx);
    if (!idsSound || !depsSound) return;

    const { remaining } = topologicalStepOrder(plan.steps);
    if (remaining.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: `Dependency cycle involving: ${remaining.map((step) => step.id).join(", ")}`,
      });
    }
  });
export type RunPlanInput = z.infer<typeof runPlanInputSchema>;
