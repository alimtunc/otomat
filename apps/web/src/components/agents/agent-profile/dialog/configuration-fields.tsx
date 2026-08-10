import { PROVIDER_DEFAULT_MODEL, type RuntimeDescriptor, type SkillContract } from "@otomat/domain";
import { Field, FieldControl, FieldLabel } from "@otomat/ui";
import { ProviderOptionsFields } from "@web/components/agents/agent-profile/dialog/provider-options-fields";
import { RuntimeFields } from "@web/components/agents/agent-profile/dialog/runtime-fields";
import { SkillsField } from "@web/components/agents/agent-profile/dialog/skills-field";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";
import { ModelSelect } from "@web/components/runs/launch/model-select";

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
          <RuntimeFields
            descriptors={descriptors}
            runtime={values.runtime}
            onRuntimeChange={(runtime) => {
              form.setFieldValue("runtime", runtime);
              form.setFieldValue("model", PROVIDER_DEFAULT_MODEL);
              form.setFieldValue("options", {});
            }}
          />
          <Field>
            <FieldLabel>Model</FieldLabel>
            <FieldControl>
              <ModelSelect
                runtimeId={values.runtime || null}
                value={values.model}
                onValueChange={(model) =>
                  form.setFieldValue("model", model ?? PROVIDER_DEFAULT_MODEL)
                }
              />
            </FieldControl>
          </Field>
          <ProviderOptionsFields
            runtime={values.runtime || null}
            model={values.model.kind === "model" ? values.model.id : null}
            options={values.options}
            onOptionsChange={(options) => form.setFieldValue("options", options)}
          />
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
