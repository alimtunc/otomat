import type {
  AgentProfileContract,
  RuntimeDescriptor,
  SaveAgentProfileRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import {
  agentProfileErrorMessage,
  useCreateAgentProfile,
  useUpdateAgentProfile,
} from "@web/api/agent-profiles/mutations";
import { supportedPermissionMode } from "@web/lib/agent-choice";
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

  const form = useForm({
    defaultValues: {
      name: profile?.name ?? "",
      runtime: defaultRuntime,
      permissionMode: supportedPermissionMode(
        descriptors,
        defaultRuntime,
        profile?.options.permission_mode,
      ),
      guidance: profile?.guidance ?? "",
      skillIds: profile?.skill_ids ?? [],
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const permissionMode = supportedPermissionMode(
        descriptors,
        value.runtime,
        value.permissionMode,
      );
      const request: SaveAgentProfileRequest = {
        name: value.name.trim(),
        runtime: value.runtime,
        options: permissionMode ? { permission_mode: permissionMode } : {},
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
