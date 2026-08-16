import { Icon, IconButton } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { DependencyToggles } from "@web/components/workflow/dependency-toggles";
import { WorkflowNameField } from "@web/components/workflow/name-field";
import { WorkflowNodeContext } from "@web/components/workflow/node-context";
import type { WorkflowPlanExecution } from "@web/components/workflow/plan-execution";
import type { PlanDraft } from "@web/components/workflow/use-plan-draft";
import { requiredTrimmed } from "@web/lib/form";
import {
  moveWorkflowStep,
  removeWorkflowStep,
  setWorkflowStepContext,
  setWorkflowStepExecution,
  toggleWorkflowDependency,
} from "@web/lib/workflow/steps";

export interface WorkflowStepCardProps {
  plan: PlanDraft;
  index: number;
  execution: WorkflowPlanExecution;
  projectId: string | null;
}

export function WorkflowStepCard({ plan, index, execution, projectId }: WorkflowStepCardProps) {
  const { form, steps, setSteps } = plan;
  const step = steps[index];
  if (!step || step.kind !== "step") return null;
  const label = `Step ${index + 1}`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-text-tertiary">{index + 1}</span>
        <form.Field
          name={`steps[${index}].name`}
          validators={{ onChange: requiredTrimmed("Name this step.") }}
        >
          {(field) => (
            <WorkflowNameField
              field={field}
              label={`${label} name`}
              placeholder={`${label} name`}
            />
          )}
        </form.Field>
        <IconButton
          type="button"
          size="sm"
          label={`Move step ${index + 1} up`}
          icon={<Icon name="arrow-up" aria-hidden />}
          disabled={index === 0}
          onClick={() => setSteps((value) => moveWorkflowStep(value, index, -1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Move step ${index + 1} down`}
          icon={<Icon name="arrow-down" aria-hidden />}
          disabled={index === steps.length - 1}
          onClick={() => setSteps((value) => moveWorkflowStep(value, index, 1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove step ${index + 1}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={steps.length === 1}
          onClick={() => setSteps((value) => removeWorkflowStep(value, index))}
        />
      </div>
      <WorkflowNodeContext
        projectId={projectId}
        value={step.context}
        onChange={(next) => setSteps((value) => setWorkflowStepContext(value, index, next))}
        label={label}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DependencyToggles
          earlier={steps.slice(0, index)}
          dependsOn={step.dependsOn}
          onToggle={(key) => setSteps((value) => toggleWorkflowDependency(value, index, key))}
        />
        <ExecutionConfigPicker
          compact
          level="step"
          value={step.execution}
          onChange={(next) => setSteps((value) => setWorkflowStepExecution(value, index, next))}
          inherited={execution.inherited}
          profiles={execution.agents.profiles}
          descriptors={execution.agents.descriptors}
          label={label}
        />
      </div>
    </div>
  );
}
