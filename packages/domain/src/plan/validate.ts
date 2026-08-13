import { z } from "zod";

import { isRunPlanCompeteGroup } from "../contracts/run-plan.js";
import { topologicalStepOrder } from "./execution-order.js";
import { RUN_PLAN_MAX_STEPS } from "./limits.js";
import { runPlanNodeInputSchema, type RunPlanNodeInput } from "./node-input.js";

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
