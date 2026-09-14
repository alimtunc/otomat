import { AttachedContextRow } from "@web/components/context/attached-context-row";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { SupervisionControl } from "@web/components/issues/workflow/supervision-control";
import { BaseBranchControl } from "@web/components/runs/launch/base/branch-control";
import { BaseRemoteRefusal } from "@web/components/runs/launch/base/remote-refusal";
import type { ReadyLaunchTarget } from "@web/components/runs/launch/use-launch-target";
import { WorkflowPlanEditor } from "@web/components/workflow/plan-editor";
import { WorkflowPresetPicker } from "@web/components/workflow/preset/preset-picker";
import { SavePresetDialog } from "@web/components/workflow/preset/save-preset-dialog";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { draftsFromPresetPlan } from "@web/lib/workflow/preset";
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

export function WorkflowPlanBuilder({
  execution,
  onExecutionChange,
  workflow,
  target,
  worktreeTarget,
}: WorkflowPlanBuilderProps) {
  const { form, plan, planError, supervisor, setSupervisor, isPending, baseRefusal } = workflow;
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
          onChange={onExecutionChange}
          label={COMPOSER_LABEL}
        />
      </div>
      {baseRefusal === null ? null : (
        <BaseRemoteRefusal refusal={baseRefusal} onRetry={() => void form.handleSubmit()} />
      )}
      <SupervisionControl
        form={form}
        agents={execution.agents}
        value={supervisor}
        onChange={setSupervisor}
        disabled={isPending}
      />
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
