import type { RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { RuntimeFields } from "@web/components/agents/agent-profile/dialog/runtime-fields";
import { SkillsField } from "@web/components/agents/agent-profile/dialog/skills-field";
import type { AgentProfileFormApi } from "@web/components/agents/agent-profile/dialog/use-form";

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
            permissionMode={values.permissionMode}
            onRuntimeChange={(runtime) => form.setFieldValue("runtime", runtime)}
            onPermissionModeChange={(permissionMode) =>
              form.setFieldValue("permissionMode", permissionMode)
            }
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
