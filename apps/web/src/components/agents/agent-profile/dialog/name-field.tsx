import { Field, FieldControl, FieldLabel, Input } from "@otomat/ui";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";
import { fieldErrorProps, requiredTrimmed } from "@web/lib/form";

export function AgentProfileNameField({ form }: { form: AgentProfileFormApi }) {
  return (
    <form.Field name="name" validators={{ onChange: requiredTrimmed("Give the profile a name.") }}>
      {(field) => (
        <Field {...fieldErrorProps(field.state.meta)}>
          <FieldLabel>Name</FieldLabel>
          <FieldControl>
            <Input
              autoFocus
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="e.g. Careful reviewer"
              aria-label="Profile name"
            />
          </FieldControl>
        </Field>
      )}
    </form.Field>
  );
}
