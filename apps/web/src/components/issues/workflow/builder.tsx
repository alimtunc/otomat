import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { LaunchAgentPicker } from "@web/components/runs/launch/launch-agent-picker";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { workflowExecutableCount } from "@web/lib/workflow-plan";

import { WorkflowCompeteCard } from "./compete-card";
import { WorkflowStepCard } from "./step-card";
import type { UseWorkflowFormResult } from "./use-form";

export interface WorkflowPlanBuilderProps {
  agents: LaunchAgentChoice;
  onAgentChoice: (choice: string | null) => void;
  workflow: UseWorkflowFormResult;
}

/** The plan editor itself — default agent, ordered steps, dependencies and compete groups — shared by every workflow launch surface. */
export function WorkflowPlanBuilder({ agents, onAgentChoice, workflow }: WorkflowPlanBuilderProps) {
  const { descriptors, profiles, choice } = agents;
  const { form, planError, updateSteps, addStep, addCompeteGroup } = workflow;

  return (
    <>
      <LaunchAgentPicker
        descriptors={descriptors}
        profiles={profiles}
        value={choice}
        onValueChange={onAgentChoice}
        isPending={agents.isPending}
        isError={agents.isError}
        isSuccess={agents.isSuccess}
        onRetry={agents.onRetry}
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
                  descriptors={descriptors}
                  profiles={profiles}
                  onUpdateSteps={updateSteps}
                />
              ) : (
                <WorkflowStepCard
                  key={step.key}
                  form={form}
                  steps={stepsField.state.value}
                  index={index}
                  descriptors={descriptors}
                  profiles={profiles}
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
