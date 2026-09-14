import { AGENT_PROFILE_GUIDANCE_MAX_LENGTH } from "@otomat/domain";
import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Field,
  FieldControl,
  Textarea,
} from "@otomat/ui";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";

export function AgentProfileGuidanceField({ form }: { form: AgentProfileFormApi }) {
  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button size="sm" variant="ghost" className="justify-start" />}>
        System guidance
      </CollapsibleTrigger>
      <CollapsiblePanel keepMounted>
        <form.Field name="guidance">
          {(field) => (
            <Field>
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
      </CollapsiblePanel>
    </Collapsible>
  );
}
