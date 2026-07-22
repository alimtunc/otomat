import { AGENT_PROFILE_GUIDANCE_MAX_LENGTH } from "@otomat/domain";
import { Field, FieldControl, FieldLabel, Textarea } from "@otomat/ui";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";

export function AgentProfileGuidanceField({ form }: { form: AgentProfileFormApi }) {
  return (
    <form.Field name="guidance">
      {(field) => (
        <Field>
          <FieldLabel>System guidance</FieldLabel>
          <FieldControl>
            <Textarea
              rows={4}
              maxLength={AGENT_PROFILE_GUIDANCE_MAX_LENGTH}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Instructions prepended to the agent's first turn (optional)."
              aria-label="System guidance"
            />
          </FieldControl>
        </Field>
      )}
    </form.Field>
  );
}
