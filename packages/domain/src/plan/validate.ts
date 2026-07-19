import { z } from "zod";

import {
  RUN_PLAN_MAX_STEPS,
  RUN_PLAN_STEP_ID_PATTERN,
  RUN_PLAN_STEP_NAME_MAX_LENGTH,
  RUN_PLAN_STEP_PROMPT_MAX_LENGTH,
} from "./limits.js";
import { topologicalStepOrder } from "./schedule.js";

export const runPlanStepInputSchema = z
  .object({
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
  })
  .strict();
export type RunPlanStepInput = z.infer<typeof runPlanStepInputSchema>;

export const runPlanCompetitorInputSchema = z
  .object({
    id: z
      .string()
      .regex(
        RUN_PLAN_STEP_ID_PATTERN,
        "Step ids are lowercase alphanumerics and dashes, 64 chars max",
      ),
    name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH),
    agent: z.string().min(1).nullable(),
    prompt: z.string().trim().min(1).max(RUN_PLAN_STEP_PROMPT_MAX_LENGTH),
  })
  .strict();
export type RunPlanCompetitorInput = z.infer<typeof runPlanCompetitorInputSchema>;

export const runPlanCompeteGroupInputSchema = z
  .object({
    id: z
      .string()
      .regex(
        RUN_PLAN_STEP_ID_PATTERN,
        "Step ids are lowercase alphanumerics and dashes, 64 chars max",
      ),
    /** Shared objective pursued by every competitor. */
    name: z.string().trim().min(1).max(RUN_PLAN_STEP_NAME_MAX_LENGTH),
    depends_on: z.array(z.string()).max(RUN_PLAN_MAX_STEPS - 1),
    compete: z
      .array(runPlanCompetitorInputSchema)
      .min(2, "Compete groups require at least two competitors")
      .max(RUN_PLAN_MAX_STEPS),
  })
  .strict();
export type RunPlanCompeteGroupInput = z.infer<typeof runPlanCompeteGroupInputSchema>;

export const runPlanNodeInputSchema = z.union([
  runPlanStepInputSchema,
  runPlanCompeteGroupInputSchema,
]);
export type RunPlanNodeInput = z.infer<typeof runPlanNodeInputSchema>;

function isCompeteGroup(node: RunPlanNodeInput): node is RunPlanCompeteGroupInput {
  return "compete" in node;
}

function checkPlanIds(
  steps: readonly RunPlanNodeInput[],
  ctx: z.RefinementCtx,
): {
  nodeIds: Set<string>;
  competitorGroups: Map<string, string>;
  sound: boolean;
} {
  const nodeIds = new Set<string>();
  const allIds = new Set<string>();
  const competitorGroups = new Map<string, string>();
  let sound = true;
  steps.forEach((step, index) => {
    if (nodeIds.has(step.id)) {
      sound = false;
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "id"],
        message: `Duplicate step id "${step.id}"`,
      });
    }
    if (allIds.has(step.id) && !nodeIds.has(step.id)) {
      sound = false;
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "id"],
        message: `Duplicate plan id "${step.id}"`,
      });
    }
    nodeIds.add(step.id);
    allIds.add(step.id);
    if (!isCompeteGroup(step)) return;
    step.compete.forEach((competitor, competitorIndex) => {
      if (allIds.has(competitor.id)) {
        sound = false;
        ctx.addIssue({
          code: "custom",
          path: ["steps", index, "compete", competitorIndex, "id"],
          message: `Duplicate plan id "${competitor.id}"`,
        });
      }
      allIds.add(competitor.id);
      competitorGroups.set(competitor.id, step.id);
    });
  });
  return { nodeIds, competitorGroups, sound };
}

function checkDependencies(
  steps: readonly RunPlanNodeInput[],
  nodeIds: ReadonlySet<string>,
  competitorGroups: ReadonlyMap<string, string>,
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
      } else if (competitorGroups.has(dependency)) {
        sound = false;
        ctx.addIssue({
          code: "custom",
          path,
          message: `Dependencies cannot target competitor "${dependency}"; depend on group "${competitorGroups.get(dependency)}"`,
        });
      } else if (!nodeIds.has(dependency)) {
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
    steps: z.array(runPlanNodeInputSchema).min(1).max(RUN_PLAN_MAX_STEPS),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const executableSteps = plan.steps.reduce(
      (count, node) => count + (isCompeteGroup(node) ? node.compete.length : 1),
      0,
    );
    if (executableSteps > RUN_PLAN_MAX_STEPS) {
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: `Run plans support at most ${RUN_PLAN_MAX_STEPS} executable steps`,
      });
    }

    const { nodeIds, competitorGroups, sound: idsSound } = checkPlanIds(plan.steps, ctx);
    const depsSound = checkDependencies(plan.steps, nodeIds, competitorGroups, ctx);
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
