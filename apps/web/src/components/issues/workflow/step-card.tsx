import { Field, FieldControl, Icon, IconButton, Input } from "@otomat/ui";
import { ContextComposer } from "@web/components/context/context-composer";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { type WorkflowNodeDraft } from "@web/lib/workflow-draft";
import {
  moveWorkflowStep,
  removeWorkflowStep,
  setWorkflowStepContext,
  setWorkflowStepExecution,
  toggleWorkflowDependency,
} from "@web/lib/workflow/steps";

import { DependencyToggles } from "./dependency-toggles";
import { targetContextScope, type WorkflowLaunchTarget } from "./launch-target";
import type { WorkflowForm } from "./use-form";

export interface WorkflowStepCardProps {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  index: number;
  execution: LaunchExecution;
  target: WorkflowLaunchTarget;
  onUpdateSteps: (update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) => void;
}

export function WorkflowStepCard({
  form,
  steps,
  index,
  execution,
  target,
  onUpdateSteps,
}: WorkflowStepCardProps) {
  const step = steps[index];
  if (!step || step.kind !== "step") return null;
  const scope = targetContextScope(target);
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
            <Field {...fieldErrorProps(field.state.meta)} className="flex-1">
              <FieldControl>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={`${label} name`}
                  aria-label={`${label} name`}
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
      <ContextComposer
        issue={scope.issue}
        projectId={scope.projectId}
        value={step.context}
        onChange={(next) => onUpdateSteps((value) => setWorkflowStepContext(value, index, next))}
        label={label}
        noteRows={2}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DependencyToggles
          earlier={steps.slice(0, index)}
          dependsOn={step.dependsOn}
          onToggle={(key) => onUpdateSteps((value) => toggleWorkflowDependency(value, index, key))}
        />
        <ExecutionConfigPicker
          compact
          level="step"
          value={step.execution}
          onChange={(next) =>
            onUpdateSteps((value) => setWorkflowStepExecution(value, index, next))
          }
          inherited={execution.selection}
          profiles={execution.agents.profiles}
          descriptors={execution.agents.descriptors}
          label={label}
        />
      </div>
    </div>
  );
}
