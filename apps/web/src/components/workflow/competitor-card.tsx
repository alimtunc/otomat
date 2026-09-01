import { Icon, IconButton } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import { WorkflowNameField } from "@web/components/workflow/name-field";
import { WorkflowNodeContext } from "@web/components/workflow/node-context";
import type { WorkflowPlanExecution } from "@web/components/workflow/plan-execution";
import type { PlanDraft } from "@web/components/workflow/use-plan-draft";
import { requiredTrimmed } from "@web/lib/form";
import { competitorLabel } from "@web/lib/workflow-draft";
import {
  removeWorkflowCompetitor,
  setWorkflowCompetitorContext,
  setWorkflowCompetitorExecution,
} from "@web/lib/workflow/competitors";

export interface WorkflowCompetitorCardProps {
  plan: PlanDraft;
  groupIndex: number;
  competitorIndex: number;
  execution: WorkflowPlanExecution;
  projectId: string | null;
}

export function WorkflowCompetitorCard({
  plan,
  groupIndex,
  competitorIndex,
  execution,
  projectId,
}: WorkflowCompetitorCardProps) {
  const { form, steps, setSteps } = plan;
  const group = steps[groupIndex];
  if (!group || group.kind !== "compete") return null;
  const competitor = group.competitors[competitorIndex];
  if (!competitor) return null;
  const label = competitorLabel(competitorIndex);

  return (
    <div className="relative flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-1 p-2.5 before:absolute before:-left-3 before:top-4 before:h-px before:w-3 before:bg-iris/50">
      <div className="flex items-center gap-2">
        <span className="text-micro font-semibold uppercase tracking-wide text-iris-text">
          {label}
        </span>
        <form.Field
          name={`steps[${groupIndex}].competitors[${competitorIndex}].name`}
          validators={{ onChange: requiredTrimmed("Name this candidate.") }}
        >
          {(field) => (
            <WorkflowNameField field={field} label={`${label} name`} placeholder="Approach name" />
          )}
        </form.Field>
        <ExecutionConfigPicker
          compact
          level="step"
          value={competitor.execution}
          onChange={(next) =>
            setSteps((value) =>
              setWorkflowCompetitorExecution(value, groupIndex, competitorIndex, next),
            )
          }
          inherited={execution.inherited}
          profiles={execution.agents.profiles}
          descriptors={execution.agents.descriptors}
          skills={execution.agents.skills}
          label={label}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove ${label}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={group.competitors.length <= 2}
          onClick={() =>
            setSteps((value) => removeWorkflowCompetitor(value, groupIndex, competitorIndex))
          }
        />
      </div>
      <WorkflowNodeContext
        projectId={projectId}
        value={competitor.context}
        onChange={(next) =>
          setSteps((value) =>
            setWorkflowCompetitorContext(value, groupIndex, competitorIndex, next),
          )
        }
        label={label}
      />
    </div>
  );
}
