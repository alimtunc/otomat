import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { WorkflowPlanEditor } from "@web/components/workflow/plan-editor";
import { WorkflowPresetPicker } from "@web/components/workflow/preset/preset-picker";
import { SavePresetDialog } from "@web/components/workflow/preset/save-preset-dialog";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { draftsFromPresetPlan } from "@web/lib/workflow/preset";
import { clearInheritedNodeOverrides } from "@web/lib/workflow/steps";
import { useState } from "react";

import { targetContextScope, type WorkflowLaunchTarget } from "./launch-target";
import type { UseWorkflowFormResult } from "./use-form";

export interface WorkflowPlanBuilderProps {
  execution: LaunchExecution;
  onExecutionChange: (execution: ExecutionSelection) => void;
  workflow: UseWorkflowFormResult;
  target: WorkflowLaunchTarget;
}

/** The launcher's composition surface: the run default, the preset library, and the node graph. */
export function WorkflowPlanBuilder({
  execution,
  onExecutionChange,
  workflow,
  target,
}: WorkflowPlanBuilderProps) {
  const { plan, planError } = workflow;
  const scope = targetContextScope(target);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <WorkflowPresetPicker
        projectId={scope.projectId}
        onApply={(preset) => plan.setSteps(draftsFromPresetPlan(preset.plan))}
        onSaveCurrent={() => setSaving(true)}
      />
      <LaunchExecutionPicker
        execution={execution}
        onChange={(next) => {
          if (next.agent !== execution.selection.agent) {
            plan.setSteps(clearInheritedNodeOverrides);
          }
          onExecutionChange(next);
        }}
        label="Workflow"
      />
      <WorkflowPlanEditor
        plan={plan}
        execution={{ agents: execution.agents, inherited: execution.selection }}
        contextScope={scope}
        error={planError}
      />
      {saving ? (
        <SavePresetDialog
          open
          onOpenChange={setSaving}
          steps={plan.steps}
          projectId={scope.projectId}
        />
      ) : null}
    </>
  );
}
