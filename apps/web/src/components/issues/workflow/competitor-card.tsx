import { Field, FieldControl, Icon, IconButton, Input, Textarea } from "@otomat/ui";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";
import type { LaunchExecution } from "@web/components/execution/use-launch-execution";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import { competitorLabel, type WorkflowNodeDraft } from "@web/lib/workflow-draft";
import {
  removeWorkflowCompetitor,
  setWorkflowCompetitorExecution,
} from "@web/lib/workflow/competitors";

import type { WorkflowForm } from "./use-form";

export function WorkflowCompetitorCard({
  form,
  steps,
  groupIndex,
  competitorIndex,
  execution,
  onUpdateSteps,
}: {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  groupIndex: number;
  competitorIndex: number;
  execution: LaunchExecution;
  onUpdateSteps: (update: (steps: WorkflowNodeDraft[]) => WorkflowNodeDraft[]) => void;
}) {
  const group = steps[groupIndex];
  if (!group || group.kind !== "compete") return null;
  const competitor = group.competitors[competitorIndex];
  if (!competitor) return null;
  const label = competitorLabel(competitorIndex);

  return (
    <div className="relative flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-1 p-2.5 before:absolute before:-left-3 before:top-4 before:h-px before:w-3 before:bg-iris/50">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-iris-text">
          {label}
        </span>
        <form.Field
          name={`steps[${groupIndex}].competitors[${competitorIndex}].name`}
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
                  aria-label={`${label} name`}
                  className="h-7 text-sm"
                />
              </FieldControl>
            </Field>
          )}
        </form.Field>
        <ExecutionConfigPicker
          compact
          level="step"
          value={competitor.execution}
          onChange={(next) =>
            onUpdateSteps((value) =>
              setWorkflowCompetitorExecution(value, groupIndex, competitorIndex, next),
            )
          }
          inherited={execution.selection}
          profiles={execution.agents.profiles}
          descriptors={execution.agents.descriptors}
          label={label}
        />
        <IconButton
          type="button"
          size="sm"
          label={`Remove ${label}`}
          icon={<Icon name="x" aria-hidden />}
          disabled={group.competitors.length <= 2}
          onClick={() =>
            onUpdateSteps((value) => removeWorkflowCompetitor(value, groupIndex, competitorIndex))
          }
        />
      </div>
      <form.Field
        name={`steps[${groupIndex}].competitors[${competitorIndex}].prompt`}
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
                aria-label={`${label} prompt`}
              />
            </FieldControl>
          </Field>
        )}
      </form.Field>
    </div>
  );
}
