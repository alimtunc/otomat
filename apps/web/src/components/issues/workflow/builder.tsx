import { AGENT_DEFAULT_EFFORT, RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { EffortSelect } from "@web/components/runs/launch/effort-select";
import { LaunchAgentModelFields } from "@web/components/runs/launch/launch-agent-model-fields";
import type { LaunchAgentChoice } from "@web/components/runs/launch/use-launch-agent-choice";
import { agentChoiceProfile, agentChoiceRuntimeId } from "@web/lib/agent-choice";
import { agentEffort, resolveRunEffort } from "@web/lib/effort-choice";
import { effectiveModelId } from "@web/lib/model-choice";
import { workflowExecutableCount } from "@web/lib/workflow-draft";
import { clearInheritedNodeOverrides } from "@web/lib/workflow/steps";

import { WorkflowCompeteCard } from "./compete-card";
import { WorkflowStepCard } from "./step-card";
import type { UseWorkflowFormResult } from "./use-form";

export interface WorkflowPlanBuilderProps {
  agents: LaunchAgentChoice;
  onAgentChoice: (choice: string | null) => void;
  workflow: UseWorkflowFormResult;
}

/** The plan editor itself — default agent, model and effort, ordered steps, dependencies and compete groups — shared by every workflow launch surface. */
export function WorkflowPlanBuilder({ agents, onAgentChoice, workflow }: WorkflowPlanBuilderProps) {
  const { form, planError, updateSteps, addStep, addCompeteGroup } = workflow;
  const runProfile = agentChoiceProfile(agents.choice, agents.profiles);

  /** A run-level change re-scopes every inheriting node, so what they kept under the old scope goes with it. */
  function rescopeInheritingNodes(changed: "agent" | "model"): void {
    updateSteps((steps) => clearInheritedNodeOverrides(steps, changed));
    form.setFieldValue("effort", AGENT_DEFAULT_EFFORT);
  }

  return (
    <form.Subscribe
      selector={(state) => ({ model: state.values.model, effort: state.values.effort })}
    >
      {({ model, effort }) => {
        const runModelId = effectiveModelId(model, runProfile?.model ?? null);
        const runEffort = resolveRunEffort(effort, agentEffort(runProfile));
        return (
          <>
            <LaunchAgentModelFields
              agents={agents}
              model={model}
              onAgentChoice={(choice) => {
                rescopeInheritingNodes("agent");
                onAgentChoice(choice);
              }}
              onModelChange={(next) => {
                rescopeInheritingNodes("model");
                form.setFieldValue("model", next);
              }}
              modelAriaLabel="Workflow model"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-text-secondary">Effort</span>
              <EffortSelect
                runtimeId={agentChoiceRuntimeId(agents.choice, agents.profiles)}
                modelId={runModelId}
                value={effort}
                onValueChange={(next) => form.setFieldValue("effort", next ?? AGENT_DEFAULT_EFFORT)}
                resolved={runEffort}
                ariaLabel="Workflow effort"
              />
            </div>
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
                        agents={agents}
                        runEffort={runEffort}
                        runModelId={runModelId}
                        onUpdateSteps={updateSteps}
                      />
                    ) : (
                      <WorkflowStepCard
                        key={step.key}
                        form={form}
                        steps={stepsField.state.value}
                        index={index}
                        agents={agents}
                        runEffort={runEffort}
                        runModelId={runModelId}
                        onUpdateSteps={updateSteps}
                      />
                    ),
                  )}
                  <div className="flex items-center gap-2 self-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        workflowExecutableCount(stepsField.state.value) >= RUN_PLAN_MAX_STEPS
                      }
                      onClick={addStep}
                    >
                      <Icon name="plus" aria-hidden />
                      Add step
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        workflowExecutableCount(stepsField.state.value) > RUN_PLAN_MAX_STEPS - 2
                      }
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
      }}
    </form.Subscribe>
  );
}
