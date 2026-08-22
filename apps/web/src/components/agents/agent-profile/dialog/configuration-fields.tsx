import type { RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { Field, FieldControl, FieldLabel } from "@otomat/ui";
import { SkillsField } from "@web/components/agents/agent-profile/dialog/skills-field";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";
import { ExecutionConfigPicker } from "@web/components/execution/execution-config-picker";

export function AgentProfileConfigurationFields({
  form,
  descriptors,
  skills,
}: {
  form: AgentProfileFormApi;
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
}) {
  return (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => (
        <>
          <Field>
            <FieldLabel>Execution</FieldLabel>
            <FieldControl>
              <ExecutionConfigPicker
                scope="runtimes"
                level="profile"
                value={values.execution}
                onChange={(execution) => form.setFieldValue("execution", execution)}
                profiles={[]}
                descriptors={descriptors}
                label="Profile"
              />
            </FieldControl>
          </Field>
          <SkillsField
            skills={skills}
            selectedIds={values.skillIds}
            onChange={(skillIds) => form.setFieldValue("skillIds", skillIds)}
          />
        </>
      )}
    </form.Subscribe>
  );
}
