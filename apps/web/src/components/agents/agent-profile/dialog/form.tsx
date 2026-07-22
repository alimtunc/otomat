import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { DialogBody } from "@otomat/ui";
import { AgentProfileConfigurationFields } from "@web/components/agents/agent-profile/dialog/configuration-fields";
import { AgentProfileFormFooter } from "@web/components/agents/agent-profile/dialog/form-footer";
import { AgentProfileGuidanceField } from "@web/components/agents/agent-profile/dialog/guidance-field";
import { AgentProfileNameField } from "@web/components/agents/agent-profile/dialog/name-field";
import { useAgentProfileForm } from "@web/components/agents/agent-profile/dialog/use-form";

export function AgentProfileForm({
  profile,
  descriptors,
  skills,
  onSaved,
  onCancel,
}: {
  profile: AgentProfileContract | null;
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { form, isPending, submitError } = useAgentProfileForm({
    profile,
    descriptors,
    onSaved,
  });

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <DialogBody className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <AgentProfileNameField form={form} />
        <AgentProfileConfigurationFields form={form} descriptors={descriptors} skills={skills} />
        <AgentProfileGuidanceField form={form} />
        {submitError === null ? null : (
          <p role="alert" className="text-xs text-danger">
            {submitError}
          </p>
        )}
      </DialogBody>
      <AgentProfileFormFooter
        form={form}
        profile={profile}
        isPending={isPending}
        onCancel={onCancel}
      />
    </form>
  );
}
