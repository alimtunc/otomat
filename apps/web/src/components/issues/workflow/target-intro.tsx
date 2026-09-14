import { Field, FieldControl, FieldLabel, Textarea } from "@otomat/ui";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";

import type { WorkflowLaunchTarget } from "./launch-target";
import type { WorkflowForm } from "./use-form";

export function WorkflowTargetIntro({
  target,
  form,
  autoFocus,
}: {
  target: WorkflowLaunchTarget;
  form: WorkflowForm;
  autoFocus: boolean;
}) {
  if (target.kind === "issue") {
    return (
      <p className="text-xs text-text-tertiary">
        Every step runs on this issue, in order, on the same branch. Steps with no dependency start
        together.
      </p>
    );
  }
  return (
    <form.Field
      name="goal"
      validators={{ onChange: requiredTrimmed("Describe the overall goal.") }}
    >
      {(field) => (
        <Field {...fieldErrorProps(field.state.meta)}>
          <FieldLabel>Goal</FieldLabel>
          <FieldControl>
            <Textarea
              autoFocus={autoFocus}
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
  );
}
