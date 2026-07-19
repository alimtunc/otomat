import type { RuntimeDescriptor } from "@otomat/domain";
import {
  Button,
  cn,
  Field,
  FieldControl,
  Icon,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { isAvailableRuntime } from "@web/lib/runtimes";
import {
  moveWorkflowStep,
  removeWorkflowStep,
  setWorkflowStepRuntime,
  toggleWorkflowDependency,
  type WorkflowStepDraft,
} from "@web/lib/workflow-plan";

import type { WorkflowForm } from "./use-workflow-form";

const DEFAULT_RUNTIME_VALUE = "__default";

export function StepRuntimeSelect({
  descriptors,
  value,
  onValueChange,
}: {
  descriptors: RuntimeDescriptor[];
  value: string | null;
  onValueChange: (runtime: string | null) => void;
}) {
  const items = [
    { value: DEFAULT_RUNTIME_VALUE, label: "Run default", disabled: false },
    ...descriptors.map((descriptor) => ({
      value: descriptor.id,
      label: descriptor.display_name,
      disabled: !isAvailableRuntime(descriptor),
    })),
  ];
  return (
    <Select
      items={items}
      value={value ?? DEFAULT_RUNTIME_VALUE}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next === DEFAULT_RUNTIME_VALUE ? null : next);
      }}
    >
      <SelectTrigger aria-label="Step runtime" className="h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DependencyToggles({
  earlier,
  dependsOn,
  onToggle,
}: {
  earlier: WorkflowStepDraft[];
  dependsOn: string[];
  onToggle: (key: string) => void;
}) {
  if (earlier.length === 0) {
    return <span className="text-xs text-text-tertiary">Runs first</span>;
  }
  const dependsOnSet = new Set(dependsOn);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-text-tertiary">After:</span>
      {earlier.map((candidate, candidateIndex) => {
        const pressed = dependsOnSet.has(candidate.key);
        return (
          <Button
            key={candidate.key}
            type="button"
            variant="outline"
            size="xs"
            aria-pressed={pressed}
            className={cn(pressed ? "border-accent text-accent" : "text-text-secondary")}
            onClick={() => onToggle(candidate.key)}
          >
            {candidate.kind === "compete" ? "Winner of " : ""}
            {candidate.name.trim() || `Step ${candidateIndex + 1}`}
          </Button>
        );
      })}
    </div>
  );
}

export interface WorkflowStepCardProps {
  form: WorkflowForm;
  steps: WorkflowStepDraft[];
  index: number;
  descriptors: RuntimeDescriptor[];
  onUpdateSteps: (update: (steps: WorkflowStepDraft[]) => WorkflowStepDraft[]) => void;
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
