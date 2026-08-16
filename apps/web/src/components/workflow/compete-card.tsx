import { RUN_PLAN_MAX_STEPS } from "@otomat/domain";
import { Button, Icon, IconButton } from "@otomat/ui";
import { WorkflowCompetitorCard } from "@web/components/workflow/competitor-card";
import { DependencyToggles } from "@web/components/workflow/dependency-toggles";
import { WorkflowNameField } from "@web/components/workflow/name-field";
import type { WorkflowPlanExecution } from "@web/components/workflow/plan-execution";
import type { PlanDraft } from "@web/components/workflow/use-plan-draft";
import { requiredTrimmed } from "@web/lib/form";
import { workflowExecutableCount } from "@web/lib/workflow-draft";
import { addWorkflowCompetitor } from "@web/lib/workflow/competitors";
import {
  moveWorkflowStep,
  removeWorkflowStep,
  toggleWorkflowDependency,
} from "@web/lib/workflow/steps";

export interface WorkflowCompeteCardProps {
  plan: PlanDraft;
  index: number;
  execution: WorkflowPlanExecution;
  projectId: string | null;
}

export function WorkflowCompeteCard({
  plan,
  index,
  execution,
  projectId,
}: WorkflowCompeteCardProps) {
  const { form, steps, setSteps } = plan;
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
            <WorkflowNameField
              field={field}
              label={`Compete group ${index + 1} objective`}
              placeholder="Shared objective"
            />
          )}
        </form.Field>
        <IconButton
          type="button"
          size="sm"
          label={`Move compete group ${index + 1} up`}
          icon={<Icon name="arrow-up" aria-hidden />}
          disabled={index === 0}
          onClick={() => setSteps((value) => moveWorkflowStep(value, index, -1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Move compete group ${index + 1} down`}
          icon={<Icon name="arrow-down" aria-hidden />}
          disabled={index === steps.length - 1}
          onClick={() => setSteps((value) => moveWorkflowStep(value, index, 1))}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove compete group ${index + 1}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={steps.length === 1}
          onClick={() => setSteps((value) => removeWorkflowStep(value, index))}
        />
      </div>

      <div className="relative ml-2 flex flex-col gap-2 border-l border-iris/40 pl-3">
        {group.competitors.map((competitor, competitorIndex) => (
          <WorkflowCompetitorCard
            key={competitor.key}
            plan={plan}
            groupIndex={index}
            competitorIndex={competitorIndex}
            execution={execution}
            projectId={projectId}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DependencyToggles
          earlier={steps.slice(0, index)}
          dependsOn={group.dependsOn}
          onToggle={(key) => setSteps((value) => toggleWorkflowDependency(value, index, key))}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={!canAddCompetitor}
          onClick={() => setSteps((value) => addWorkflowCompetitor(value, index))}
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
