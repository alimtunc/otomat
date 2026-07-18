import { RUN_PLAN_MAX_STEPS, runPlanInputSchema, type RuntimeDescriptor } from "@otomat/domain";
import {
  Button,
  cn,
  DialogBody,
  Field,
  FieldControl,
  FieldLabel,
  Icon,
  IconButton,
  Input,
  Kbd,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useRuntimes } from "@web/api/daemon/queries";
import { useStartRunAndNavigate } from "@web/api/runs/mutations";
import { IssueFormFooter } from "@web/components/issues/issue-form-footer";
import { RuntimePicker } from "@web/components/runs/launch/runtime-picker";
import { fieldErrorProps, hasText, requiredTrimmed, submitOnCmdEnter } from "@web/lib/form";
import { isAvailableRuntime, resolveRuntimeChoice } from "@web/lib/runtimes";
import {
  buildRunPlanInput,
  moveWorkflowStep,
  newWorkflowStep,
  removeWorkflowStep,
  setWorkflowStepRuntime,
  toggleWorkflowDependency,
  type WorkflowStepDraft,
} from "@web/lib/workflow-plan";
import { useRef, useState } from "react";

const DEFAULT_RUNTIME_VALUE = "__default";

function StepRuntimeSelect({
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

function DependencyToggles({
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
            {candidate.name.trim() || `Step ${candidateIndex + 1}`}
          </Button>
        );
      })}
    </div>
  );
}

export interface WorkflowIssueFormProps {
  runtimeChoice: string | null;
  onRuntimeChoice: (runtime: string) => void;
  onLaunched: () => void;
  onCancel: () => void;
}

export function WorkflowIssueForm({
  runtimeChoice,
  onRuntimeChoice,
  onLaunched,
  onCancel,
}: WorkflowIssueFormProps) {
  const { start, isPending } = useStartRunAndNavigate();
  const runtimes = useRuntimes();
  const descriptors = runtimes.data ?? [];
  const runtime = resolveRuntimeChoice(descriptors, runtimeChoice);
  const stepCounter = useRef(1);
  const [planError, setPlanError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { goal: "", steps: [newWorkflowStep(1)] },
    onSubmit: async ({ value }) => {
      if (runtime === null) return;
      const plan = buildRunPlanInput(value.steps);
      const parsed = runPlanInputSchema.safeParse(plan);
      if (!parsed.success) {
        setPlanError(parsed.error.issues[0]?.message ?? "The workflow plan is invalid.");
        return;
      }
      setPlanError(null);
      const started = await start({ prompt: value.goal.trim(), runtime, plan: parsed.data });
      if (started) {
        form.reset();
        onLaunched();
      }
    },
  });

  function updateSteps(update: (steps: WorkflowStepDraft[]) => WorkflowStepDraft[]) {
    form.setFieldValue("steps", update(form.getFieldValue("steps")));
    setPlanError(null);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      onKeyDown={submitOnCmdEnter(() => void form.handleSubmit())}
    >
      <DialogBody className="flex max-h-[62vh] flex-col gap-3 overflow-y-auto">
        <form.Field
          name="goal"
          validators={{ onChange: requiredTrimmed("Describe the overall goal.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)}>
              <FieldLabel>Goal</FieldLabel>
              <FieldControl>
                <Textarea
                  autoFocus
                  rows={2}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="What should this workflow achieve? Becomes the issue."
                  aria-label="Workflow goal"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <RuntimePicker
          descriptors={descriptors}
          value={runtime}
          onValueChange={onRuntimeChoice}
          isPending={runtimes.isPending}
          isError={runtimes.isError}
          isSuccess={runtimes.isSuccess}
          onRetry={() => void runtimes.refetch()}
        />
        <form.Field name="steps">
          {(stepsField) => (
            <div className="flex flex-col gap-2">
              {stepsField.state.value.map((step, index) => (
                <div
                  key={step.key}
                  className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-2.5"
                >
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
                      onClick={() => updateSteps((steps) => moveWorkflowStep(steps, index, -1))}
                    />
                    <IconButton
                      type="button"
                      size="sm"
                      label={`Move step ${index + 1} down`}
                      icon={<Icon name="arrow-down" aria-hidden />}
                      disabled={index === stepsField.state.value.length - 1}
                      onClick={() => updateSteps((steps) => moveWorkflowStep(steps, index, 1))}
                    />
                    <IconButton
                      type="button"
                      size="sm"
                      label={`Remove step ${index + 1}`}
                      icon={<Icon name="x" aria-hidden />}
                      disabled={stepsField.state.value.length === 1}
                      onClick={() => updateSteps((steps) => removeWorkflowStep(steps, index))}
                    />
                  </div>
                  <form.Field
                    name={`steps[${index}].prompt`}
                    validators={{
                      onChange: requiredTrimmed("Tell the agent what this step does."),
                    }}
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
                      earlier={stepsField.state.value.slice(0, index)}
                      dependsOn={step.dependsOn}
                      onToggle={(key) =>
                        updateSteps((steps) => toggleWorkflowDependency(steps, index, key))
                      }
                    />
                    <div className="w-36">
                      <StepRuntimeSelect
                        descriptors={descriptors}
                        value={step.runtime}
                        onValueChange={(next) =>
                          updateSteps((steps) => setWorkflowStepRuntime(steps, index, next))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={stepsField.state.value.length >= RUN_PLAN_MAX_STEPS}
                onClick={() => {
                  stepCounter.current += 1;
                  updateSteps((steps) => [...steps, newWorkflowStep(stepCounter.current)]);
                }}
              >
                <Icon name="plus" aria-hidden />
                Add step
              </Button>
            </div>
          )}
        </form.Field>
        {planError === null ? null : (
          <p role="alert" className="text-xs text-danger">
            {planError}
          </p>
        )}
      </DialogBody>
      <IssueFormFooter
        onCancel={onCancel}
        submit={
          <form.Subscribe
            selector={(state) =>
              hasText(state.values.goal) &&
              state.values.steps.length > 0 &&
              state.values.steps.every((step) => hasText(step.name) && hasText(step.prompt))
            }
          >
            {(filled) => (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={isPending}
                disabled={!(filled && runtime !== null && !isPending)}
              >
                Launch workflow
                <Kbd className="border-[rgba(255,255,255,.4)] text-on-accent">⌘↵</Kbd>
              </Button>
            )}
          </form.Subscribe>
        }
      />
    </form>
  );
}
