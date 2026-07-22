import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Field, FieldControl, Icon, IconButton, Input, Textarea } from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";
import {
  competitorLabel,
  removeWorkflowCompetitor,
  updateWorkflowCompetitor,
  type WorkflowNodeDraft,
} from "@web/lib/workflow-plan";

import { StepAgentSelect } from "./node-controls";
import type { WorkflowForm } from "./use-form";

export function WorkflowCompetitorCard({
  form,
  steps,
  groupIndex,
  competitorIndex,
  descriptors,
  profiles,
  onUpdateSteps,
}: {
  form: WorkflowForm;
  steps: WorkflowNodeDraft[];
  groupIndex: number;
  competitorIndex: number;
  descriptors: RuntimeDescriptor[];
  profiles: AgentProfileContract[];
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
        <div className="w-52 shrink-0">
          <StepAgentSelect
            profiles={profiles}
            descriptors={descriptors}
            label={`${label} agent`}
            value={competitor.agent}
            onValueChange={(agent) =>
              onUpdateSteps((value) =>
                updateWorkflowCompetitor(value, groupIndex, competitorIndex, { agent }),
              )
            }
          />
        </div>
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
