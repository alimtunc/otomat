import {
  modelSelectionFromId,
  type AgentProfileContract,
  type ProviderOptions,
  type RuntimeDescriptor,
  type SaveAgentProfileRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  agentProfileErrorMessage,
  useCreateAgentProfile,
  useUpdateAgentProfile,
} from "@web/api/agent-profiles/mutations";
import { profileModelFromSelection } from "@web/lib/model-choice";
import { resolveRuntimeChoice } from "@web/lib/runtimes";
import { useState } from "react";

export function useAgentProfileForm({
  profile,
  descriptors,
  onSaved,
}: {
  profile: AgentProfileContract | null;
  descriptors: RuntimeDescriptor[];
  onSaved: () => void;
}) {
  const create = useCreateAgentProfile();
  const update = useUpdateAgentProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultRuntime = profile?.runtime ?? resolveRuntimeChoice(descriptors, null) ?? "";
  const defaultOptions: ProviderOptions = profile?.options ?? {};

  const form = useForm({
    defaultValues: {
      name: profile?.name ?? "",
      runtime: defaultRuntime,
      options: defaultOptions,
      model: modelSelectionFromId(profile?.model ?? null),
      guidance: profile?.guidance ?? "",
      skillIds: profile?.skill_ids ?? [],
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const request: SaveAgentProfileRequest = {
        name: value.name.trim(),
        runtime: value.runtime,
        options: value.options,
        model: profileModelFromSelection(value.model),
        guidance: value.guidance.trim() ? value.guidance.trim() : null,
        skill_ids: value.skillIds,
      };
      try {
        if (profile) await update.mutateAsync({ id: profile.id, request });
        else await create.mutateAsync(request);
        toast.success(profile ? "Profile updated" : "Profile created");
        form.reset();
        onSaved();
      } catch (error) {
        setSubmitError(agentProfileErrorMessage(error));
      }
    },
  });

  return {
    form,
    isPending: create.isPending || update.isPending,
    submitError,
  };
}

export type AgentProfileFormApi = ReturnType<typeof useAgentProfileForm>["form"];
