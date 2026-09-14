import type { ExecutionSelection } from "@web/lib/execution/selection";
import type { WorkflowNodeDraft } from "@web/lib/workflow-draft";

export function hasWorkflowExecutionOverride(selection: ExecutionSelection): boolean {
  return (
    selection.agent !== null ||
    selection.model !== undefined ||
    Object.keys(selection.options).length > 0
  );
}

export function hasWorkflowDraft(steps: readonly WorkflowNodeDraft[]): boolean {
  if (steps.length !== 1) return true;
  return steps.some(
    (step) =>
      step.kind === "compete" ||
      step.name.trim().length > 0 ||
      step.context.note.trim().length > 0 ||
      step.context.references.length > 0 ||
      step.dependsOn.length > 0 ||
      hasWorkflowExecutionOverride(step.execution),
  );
}
