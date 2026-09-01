import type {
  AgentProfileContract,
  RuntimeDescriptor,
  SaveAgentProfileRequest,
} from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useForm } from "@tanstack/react-form";
import { useCreateAgentProfile, useUpdateAgentProfile } from "@web/api/agent-profiles/mutations";
import { agentChoiceRuntimeId } from "@web/lib/agent/choice";
import { agentConfigRefusalMessage } from "@web/lib/agent/config-error";
import { selectionFromStored, storedFromSelection } from "@web/lib/execution/stored";
import { resolveRuntimeChoice } from "@web/lib/runtimes";
import { useState } from "react";

export function useAgentProfileForm({
  profile,
  projectId,
  descriptors,
  onSaved,
}: {
  profile: AgentProfileContract | null;
  projectId: string | null;
  descriptors: RuntimeDescriptor[];
  onSaved: () => void;
}) {
  const create = useCreateAgentProfile();
  const update = useUpdateAgentProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: profile?.name ?? "",
      execution: selectionFromStored({
        runtime: profile?.runtime ?? resolveRuntimeChoice(descriptors, null),
        model: profile?.model ?? null,
        options: profile?.options ?? {},
      }),
      guidance: profile?.guidance ?? "",
      skillIds: profile?.skill_ids ?? [],
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const runtime = agentChoiceRuntimeId(value.execution.agent, []);
      if (runtime === null) {
        setSubmitError("Pick the runtime this profile launches on.");
        return;
      }
      const stored = storedFromSelection(value.execution, runtime);
      const request: SaveAgentProfileRequest = {
        name: value.name.trim(),
        project_id: projectId,
        runtime,
        options: stored.options,
        model: stored.model,
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
        setSubmitError(agentConfigRefusalMessage(error, "the profile"));
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
