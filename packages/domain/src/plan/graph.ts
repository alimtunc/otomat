import type { z } from "zod";

import { isRunPlanCompeteGroup } from "../contracts/run-plan.js";
import { topologicalStepOrder } from "./execution-order.js";
import { RUN_PLAN_MAX_STEPS } from "./limits.js";

interface PlanGraphStep {
  readonly id: string;
  readonly depends_on: readonly string[];
}

interface PlanGraphCompeteGroup extends PlanGraphStep {
  readonly compete: readonly { readonly id: string }[];
}

/** Ids and edges only, so a launch plan and a saved preset are checked by the same walk. */
export type PlanGraphNode = PlanGraphStep | PlanGraphCompeteGroup;

/** Agent turns the graph holds: a compete group costs one per candidate, not one per group. */
export function planExecutableCount(steps: readonly PlanGraphNode[]): number {
  return steps.reduce(
    (count, node) => count + (isRunPlanCompeteGroup(node) ? node.compete.length : 1),
    0,
  );
}

function checkExecutableCount(steps: readonly PlanGraphNode[], ctx: z.RefinementCtx): void {
  if (planExecutableCount(steps) > RUN_PLAN_MAX_STEPS) {
    ctx.addIssue({
      code: "custom",
      path: ["steps"],
      message: `Run plans support at most ${RUN_PLAN_MAX_STEPS} executable steps`,
    });
  }
}

interface PlanIdIndex {
  nodeIds: Set<string>;
  competitorGroups: Map<string, string>;
  sound: boolean;
}

function checkPlanIds(steps: readonly PlanGraphNode[], ctx: z.RefinementCtx): PlanIdIndex {
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
  steps: readonly PlanGraphNode[],
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

/** Unique ids, resolvable edges, no cycle, within the executable cap. */
export function refinePlanGraph(steps: readonly PlanGraphNode[], ctx: z.RefinementCtx): void {
  checkExecutableCount(steps, ctx);
  const { nodeIds, competitorGroups, sound: idsSound } = checkPlanIds(steps, ctx);
  const depsSound = checkDependencies(steps, nodeIds, competitorGroups, ctx);
  if (!idsSound || !depsSound) return;

  const { remaining } = topologicalStepOrder(steps);
  if (remaining.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["steps"],
      message: `Dependency cycle involving: ${remaining.map((step) => step.id).join(", ")}`,
    });
  }
}
