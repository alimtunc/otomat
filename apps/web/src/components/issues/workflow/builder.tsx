import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { LaunchExecutionPicker } from "@web/components/execution/launch-execution-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import type { ExecutionSelection } from "@web/lib/execution/selection";
import { workflowExecutableCount } from "@web/lib/workflow-draft";
import { clearInheritedNodeOverrides } from "@web/lib/workflow/steps";

import { WorkflowCompeteCard } from "./compete-card";
import { WorkflowStepCard } from "./step-card";
import type { UseWorkflowFormResult } from "./use-form";

export interface WorkflowPlanBuilderProps {
  execution: LaunchExecution;
  onExecutionChange: (execution: ExecutionSelection) => void;
  workflow: UseWorkflowFormResult;
}

export function WorkflowPlanBuilder({
  execution,
  onExecutionChange,
  workflow,
}: WorkflowPlanBuilderProps) {
  const { form, planError, updateSteps, addStep, addCompeteGroup } = workflow;

  return (
    <>
      <LaunchExecutionPicker
        execution={execution}
        onChange={(next) => {
          if (next.agent !== execution.selection.agent) updateSteps(clearInheritedNodeOverrides);
          onExecutionChange(next);
        }}
        label="Workflow"
      />
      <form.Field name="steps">
        {(stepsField) => (
          <div className="flex flex-col gap-2">
            {stepsField.state.value.map((step, index) =>
              step.kind === "compete" ? (
                <WorkflowCompeteCard
                  key={step.key}
                  form={form}
                  steps={stepsField.state.value}
                  index={index}
                  execution={execution}
                  onUpdateSteps={updateSteps}
                />
              ) : (
                <WorkflowStepCard
                  key={step.key}
                  form={form}
                  steps={stepsField.state.value}
                  index={index}
                  execution={execution}
                  onUpdateSteps={updateSteps}
                />
              ),
            )}
            <div className="flex items-center gap-2 self-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={workflowExecutableCount(stepsField.state.value) >= RUN_PLAN_MAX_STEPS}
                onClick={addStep}
              >
                <Icon name="plus" aria-hidden />
                Add step
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={workflowExecutableCount(stepsField.state.value) > RUN_PLAN_MAX_STEPS - 2}
                onClick={addCompeteGroup}
              >
                <Icon name="workflow" aria-hidden />
                Add compete group
              </Button>
            </div>
          </div>
        )}
      </form.Field>
      {planError === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {planError}
        </p>
      )}
    </>
  );
}
