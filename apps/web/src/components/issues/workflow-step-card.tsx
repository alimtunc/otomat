import type { RuntimeDescriptor } from "@otomat/domain";
import { Field, FieldControl, Icon, IconButton, Input, Textarea } from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import {
  moveWorkflowStep,
  removeWorkflowStep,
  setWorkflowStepRuntime,
  toggleWorkflowDependency,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";

import type { WorkflowForm } from "./use-workflow-form";
import { DependencyToggles, StepRuntimeSelect } from "./workflow-node-controls";

export interface WorkflowStepCardProps {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  index: number;
  descriptors: RuntimeDescriptor[];
  onUpdateSteps: (update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) => void;
}

export function WorkflowStepCard({
  form,
  steps,
  index,
  descriptors,
  onUpdateSteps,
}: WorkflowStepCardProps) {
  const step = steps[index];
  if (!step || step.kind !== "step") return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-text-tertiary">{index + 1}</span>
        <form.Field
          name={`steps[${index}].name`}
          validators={{ onChange: requiredTrimmed("Name this step.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)} className="flex-1">
              <FieldControl>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={`Step ${index + 1} name`}
                  aria-label={`Step ${index + 1} name`}
                  className="h-7 text-sm"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <IconButton
          type="button"
          size="sm"
          label={`Move step ${index + 1} up`}
          icon={<Icon name="arrow-up" aria-hidden />}
          disabled={index === 0}
          onClick={() => onUpdateSteps((value) => moveWorkflowStep(value, index, -1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Move step ${index + 1} down`}
          icon={<Icon name="arrow-down" aria-hidden />}
          disabled={index === steps.length - 1}
          onClick={() => onUpdateSteps((value) => moveWorkflowStep(value, index, 1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove step ${index + 1}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={steps.length === 1}
          onClick={() => onUpdateSteps((value) => removeWorkflowStep(value, index))}
        />
      </div>
      <form.Field
        name={`steps[${index}].prompt`}
        validators={{ onChange: requiredTrimmed("Tell the agent what this step does.") }}
      >
        {(field) => (
          <Field {...fieldErrorProps(field.state.meta)}>
            <FieldControl>
              <Textarea
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Prompt for this step"
                aria-label={`Step ${index + 1} prompt`}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DependencyToggles
          earlier={steps.slice(0, index)}
          dependsOn={step.dependsOn}
          onToggle={(key) => onUpdateSteps((value) => toggleWorkflowDependency(value, index, key))}
        />
        <div className="w-36">
          <StepRuntimeSelect
            descriptors={descriptors}
            label={`Step ${index + 1} runtime`}
            value={step.runtime}
            onValueChange={(next) =>
              onUpdateSteps((value) => setWorkflowStepRuntime(value, index, next))
            }
          />
        </div>
      </div>
    </div>
  );
}
