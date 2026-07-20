import { RUN_PLAN_MAX_STEPS, type RuntimeDescriptor } from "@otomat/domain";
import { Button, Field, FieldControl, Icon, IconButton, Input, Textarea } from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import {
  addWorkflowCompetitor,
  competitorLabel,
  moveWorkflowStep,
  removeWorkflowCompetitor,
  removeWorkflowStep,
  toggleWorkflowDependency,
  updateWorkflowCompetitor,
  workflowExecutableCount,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";

import type { WorkflowForm } from "./use-workflow-form";
import { DependencyToggles, StepRuntimeSelect } from "./workflow-step-card";

export interface WorkflowCompeteCardProps {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  index: number;
  descriptors: RuntimeDescriptor[];
  onUpdateSteps: (update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) => void;
}

export function WorkflowCompeteCard({
  form,
  steps,
  index,
  descriptors,
  onUpdateSteps,
}: WorkflowCompeteCardProps) {
  const group = steps[index];
  if (!group || group.kind !== "compete") return null;
  const canAddCompetitor = workflowExecutableCount(steps) < RUN_PLAN_MAX_STEPS;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-iris/40 bg-iris-bg p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-md bg-iris-subtle px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-iris-text">
          <Icon name="git-compare" aria-hidden className="h-3 w-3" />
          Compete
        </span>
        <span className="text-xs font-semibold text-text-tertiary">{index + 1}</span>
        <form.Field
          name={`steps[${index}].name`}
          validators={{ onChange: requiredTrimmed("Name the shared objective.") }}
        >
          {(field) => (
            <Field {...fieldErrorProps(field.state.meta)} className="flex-1">
              <FieldControl>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Shared objective"
                  aria-label={`Compete group ${index + 1} objective`}
                  className="h-7 text-sm"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <IconButton
          type="button"
          size="sm"
          label={`Move compete group ${index + 1} up`}
          icon={<Icon name="arrow-up" aria-hidden />}
          disabled={index === 0}
          onClick={() => onUpdateSteps((value) => moveWorkflowStep(value, index, -1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Move compete group ${index + 1} down`}
          icon={<Icon name="arrow-down" aria-hidden />}
          disabled={index === steps.length - 1}
          onClick={() => onUpdateSteps((value) => moveWorkflowStep(value, index, 1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove compete group ${index + 1}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={steps.length === 1}
          onClick={() => onUpdateSteps((value) => removeWorkflowStep(value, index))}
        />
      </div>

      <div className="relative ml-2 flex flex-col gap-2 border-l border-iris/40 pl-3">
        {group.competitors.map((competitor, competitorIndex) => (
          <div
            key={competitor.key}
            className="relative flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-1 p-2.5 before:absolute before:-left-3 before:top-4 before:h-px before:w-3 before:bg-iris/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-iris-text">
                {competitorLabel(competitorIndex)}
              </span>
              <form.Field
                name={`steps[${index}].competitors[${competitorIndex}].name`}
                validators={{ onChange: requiredTrimmed("Name this candidate.") }}
              >
                {(field) => (
                  <Field {...fieldErrorProps(field.state.meta)} className="flex-1">
                    <FieldControl>
                      <Input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Approach name"
                        aria-label={`${competitorLabel(competitorIndex)} name`}
                        className="h-7 text-sm"
                      />
                    </FieldControl>
                  </Field>
                )}
              </form.Field>
              <div className="w-36">
                <StepRuntimeSelect
                  descriptors={descriptors}
                  value={competitor.runtime}
                  onValueChange={(runtime) =>
                    onUpdateSteps((value) =>
                      updateWorkflowCompetitor(value, index, competitorIndex, { runtime }),
                    )
                  }
                />
              </div>
              <IconButton
                type="button"
                size="sm"
                label={`Remove ${competitorLabel(competitorIndex)}`}
                icon={<Icon name="x" aria-hidden />}
                disabled={group.competitors.length <= 2}
                onClick={() =>
                  onUpdateSteps((value) => removeWorkflowCompetitor(value, index, competitorIndex))
                }
              />
            </div>
            <form.Field
              name={`steps[${index}].competitors[${competitorIndex}].prompt`}
              validators={{ onChange: requiredTrimmed("Tell this candidate what to do.") }}
            >
              {(field) => (
                <Field {...fieldErrorProps(field.state.meta)}>
                  <FieldControl>
                    <Textarea
                      rows={2}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      placeholder="Prompt for this candidate"
                      aria-label={`${competitorLabel(competitorIndex)} prompt`}
                    />
                  </FieldControl>
                </Field>
              )}
            </form.Field>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DependencyToggles
          earlier={steps.slice(0, index)}
          dependsOn={group.dependsOn}
          onToggle={(key) => onUpdateSteps((value) => toggleWorkflowDependency(value, index, key))}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!canAddCompetitor}
          onClick={() => onUpdateSteps((value) => addWorkflowCompetitor(value, index))}
        >
          <Icon name="plus" aria-hidden />
          Add candidate
        </Button>
      </div>

      <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-bg px-2.5 py-2 text-xs leading-4 text-warning">
        <Icon name="alert-triangle" aria-hidden className="mt-0.25 h-3.5 w-3.5 shrink-0" />
        Steps that depend on this group stay queued until you compare the results and select a
        winner.
      </p>
    </div>
  );
}
