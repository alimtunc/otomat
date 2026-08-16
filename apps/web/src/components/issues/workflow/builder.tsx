import { AttachedContextRow } from "@web/components/context/attached-context-row";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { BaseBranchControl } from "@web/components/runs/launch/base-branch-control";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { WorkflowPlanEditor } from "@web/components/workflow/plan-editor";
import { WorkflowPresetPicker } from "@web/components/workflow/preset/preset-picker";
import { SavePresetDialog } from "@web/components/workflow/preset/save-preset-dialog";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { draftsFromPresetPlan } from "@web/lib/workflow/preset";
import { clearInheritedNodeOverrides } from "@web/lib/workflow/steps";
import { useState } from "react";

import { targetProjectId, type WorkflowLaunchTarget } from "./launch-target";
import type { UseWorkflowFormResult } from "./use-form";

const COMPOSER_LABEL = "Workflow";

export interface WorkflowPlanBuilderProps {
  execution: LaunchExecution;
  onExecutionChange: (execution: ExecutionSelection) => void;
  workflow: UseWorkflowFormResult;
  target: WorkflowLaunchTarget;
  worktreeTarget: ReadyLaunchTarget;
}

/** The launcher's composition surface: what every node inherits, then the node graph. */
export function WorkflowPlanBuilder({
  execution,
  onExecutionChange,
  workflow,
  target,
  worktreeTarget,
}: WorkflowPlanBuilderProps) {
  const { plan, planError, isPending } = workflow;
  const projectId = targetProjectId(target);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {target.kind === "issue" ? (
          <AttachedContextRow
            issue={target.issue}
            projectId={projectId}
            references={[]}
            label={COMPOSER_LABEL}
          />
        ) : null}
        <WorkflowPresetPicker
          projectId={projectId}
          onApply={(preset) => plan.setSteps(draftsFromPresetPlan(preset.plan))}
          onSaveCurrent={() => setSaving(true)}
        />
        <BaseBranchControl target={worktreeTarget} disabled={isPending} />
        <LaunchExecutionPicker
          execution={execution}
          onChange={(next) => {
            if (next.agent !== execution.selection.agent) {
              plan.setSteps(clearInheritedNodeOverrides);
            }
            onExecutionChange(next);
          }}
          label={COMPOSER_LABEL}
        />
      </div>
      <WorkflowPlanEditor
        plan={plan}
        execution={{ agents: execution.agents, inherited: execution.selection }}
        projectId={projectId}
        error={planError}
      />
      {saving ? (
        <SavePresetDialog open onOpenChange={setSaving} steps={plan.steps} projectId={projectId} />
      ) : null}
    </>
  );
}
