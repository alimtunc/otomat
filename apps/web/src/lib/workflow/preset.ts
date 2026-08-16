import {
  isRunPlanCompeteGroup,
  type WorkflowPresetContract,
  type WorkflowPresetExecutable,
  type WorkflowPresetPlan,
  type WorkflowPresetScope,
} from "@otomat/domain";
import { nodeAgentChoice } from "@web/lib/agent-choice";
import type {
  WorkflowCompetitorDraft,
  WorkflowNodeDraft,
  WorkflowStepDraft,
} from "@web/lib/workflow-draft";

import { buildRunPlanInput } from "./plan-input";

/** A scoped list only ever carries this project's presets, so `project` needs no project name. */
export const PRESET_SCOPE_LABEL: Record<WorkflowPresetScope, string> = {
  global: "Global",
  project: "This project",
};

/** A preset is a launch plan without what a launch attaches to it: no issue, no repository file. */
function withoutContext<T extends { context?: unknown }>(node: T): Omit<T, "context"> {
  const { context: _attached, ...template } = node;
  return template;
}

export function presetPlanFromDrafts(steps: readonly WorkflowNodeDraft[]): WorkflowPresetPlan {
  return {
    version: 1,
    steps: buildRunPlanInput(steps).steps.map((node) =>
      isRunPlanCompeteGroup(node)
        ? { ...node, compete: node.compete.map(withoutContext) }
        : withoutContext(node),
    ),
  };
}

function executableDraft(node: WorkflowPresetExecutable): WorkflowCompetitorDraft {
  return {
    key: node.id,
    name: node.name,
    context: { references: [], note: node.note ?? "" },
    execution: {
      agent: nodeAgentChoice(node),
      ...(node.model === undefined ? {} : { model: node.model }),
      options: node.options ?? {},
    },
  };
}

export function draftsFromPresetPlan(plan: WorkflowPresetPlan): WorkflowNodeDraft[] {
  return plan.steps.map((node): WorkflowNodeDraft => {
    if (isRunPlanCompeteGroup(node)) {
      return {
        kind: "compete",
        key: node.id,
        name: node.name,
        dependsOn: [...node.depends_on],
        competitors: node.compete.map(executableDraft),
      };
    }
    const draft: WorkflowStepDraft = {
      kind: "step",
      ...executableDraft(node),
      dependsOn: [...node.depends_on],
    };
    return draft;
  });
}

/** The one sentence saying why this host could not launch the preset; null when it could. */
export function presetBlockedReason(preset: WorkflowPresetContract): string | null {
  if (preset.compatibility.launchable) return null;
  const [first, ...rest] = preset.compatibility.issues;
  if (first === undefined) return "This preset has no step yet.";
  const others = rest.length === 0 ? "" : ` (+${rest.length} more)`;
  return `${first.node_name}: ${first.message}${others}`;
}
