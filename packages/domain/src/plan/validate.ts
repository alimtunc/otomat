import { z } from "zod";

import { isRunPlanCompeteGroup } from "../contracts/entities/runs.js";
import {
  RUN_PLAN_MAX_STEPS,
  RUN_PLAN_STEP_ID_PATTERN,
  RUN_PLAN_STEP_NAME_MAX_LENGTH,
  RUN_PLAN_STEP_PROMPT_MAX_LENGTH,
} from "./limits.js";
import { topologicalStepOrder } from "./schedule.js";

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
    if (allIds.has(step.id)) {
      sound = false;
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "id"],
        message: `Duplicate plan id "${step.id}"`,
      });
    }
    nodeIds.add(step.id);
    allIds.add(step.id);
    if (!isRunPlanCompeteGroup(step)) return;
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
      (count, node) => count + (isRunPlanCompeteGroup(node) ? node.compete.length : 1),
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
