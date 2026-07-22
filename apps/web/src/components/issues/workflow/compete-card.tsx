import {
  RUN_PLAN_MAX_STEPS,
  type AgentProfileContract,
  type RuntimeDescriptor,
} from "@otomat/domain";
import { Button, Field, FieldControl, Icon, IconButton, Input } from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import {
  addWorkflowCompetitor,
  moveWorkflowStep,
  removeWorkflowStep,
  toggleWorkflowDependency,
  workflowExecutableCount,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";

import { WorkflowCompetitorCard } from "./competitor-card";
import { DependencyToggles } from "./node-controls";
import type { WorkflowForm } from "./use-form";

export interface WorkflowCompeteCardProps {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  index: number;
  descriptors: RuntimeDescriptor[];
  profiles: AgentProfileContract[];
  onUpdateSteps: (update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) => void;
}

export function WorkflowCompeteCard({
  form,
  steps,
  index,
  descriptors,
  profiles,
  onUpdateSteps,
}: WorkflowCompeteCardProps) {
  const group = steps[index];
  if (!group || group.kind !== "compete") return null;
  const canAddCompetitor = workflowExecutableCount(steps) < RUN_PLAN_MAX_STEPS;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-iris/40 bg-iris-bg p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-md bg-iris-subtle px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-iris-text">
          <Icon name="workflow" aria-hidden className="h-3.5 w-3.5" />
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
          <WorkflowCompetitorCard
            key={competitor.key}
            form={form}
            steps={steps}
            groupIndex={index}
            competitorIndex={competitorIndex}
            descriptors={descriptors}
            profiles={profiles}
            onUpdateSteps={onUpdateSteps}
          />
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

      <p className="flex items-start gap-1.5 rounded-md border border-iris/20 bg-iris-subtle px-2.5 py-2 text-xs leading-4 text-text-secondary">
        <Icon
          name="alert-triangle"
          aria-hidden
          className="mt-0.25 h-3.5 w-3.5 shrink-0 text-iris-text"
        />
        Steps that depend on this group stay queued until you compare the results and select a
        winner.
      </p>
    </div>
  );
}
