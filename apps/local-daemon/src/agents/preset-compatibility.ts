import type { Db } from "@otomat/db";
import {
  isRunPlanCompeteGroup,
  overrideLevel,
  type WorkflowPresetCompatibility,
  type WorkflowPresetExecutable,
  type WorkflowPresetIssue,
  type WorkflowPresetPlan,
} from "@otomat/domain";

import { agentConfigRefusal } from "./refusal.js";
import { nodeAgentSelector, resolveAgentConfig } from "./resolve.js";

/** Resolves the node exactly as a launch would, then throws the result away: nothing is frozen here. */
function nodeIssue(db: Db, node: WorkflowPresetExecutable): WorkflowPresetIssue | null {
  const selector = nodeAgentSelector(node);
  if (selector === null) return null;
  try {
    resolveAgentConfig(db, selector, {
      levels: [overrideLevel("step", { model: node.model, options: node.options })],
    });
    return null;
  } catch (error) {
    const refusal = agentConfigRefusal(error);
    if (refusal === null) throw error;
    return { node_id: node.id, node_name: node.name, ...refusal };
  }
}

/**
 * Whether this host could launch the preset today. A node that names no agent of its own is
 * silent here rather than assumed sound: what it inherits is the launch's own configuration,
 * which the launch gate resolves.
 */
export function workflowPresetCompatibility(
  db: Db,
  plan: WorkflowPresetPlan,
): WorkflowPresetCompatibility {
  const executables: WorkflowPresetExecutable[] = plan.steps.flatMap((node) =>
    isRunPlanCompeteGroup(node) ? node.compete : [node],
  );
  const issues = executables.map((node) => nodeIssue(db, node)).filter((issue) => issue !== null);
  return { launchable: executables.length > 0 && issues.length === 0, issues };
}
