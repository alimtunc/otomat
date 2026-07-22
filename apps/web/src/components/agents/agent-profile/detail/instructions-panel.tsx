import {
  AGENT_PROFILE_GUIDANCE_MAX_LENGTH,
  type AgentProfileContract,
  type RuntimeDescriptor,
} from "@otomat/domain";
import { Button, Field, FieldControl, FieldLabel, Textarea, toast } from "@otomat/ui";
import { agentProfileErrorMessage, useUpdateAgentProfile } from "@web/api/agent-profiles/mutations";
import { requestForProfile } from "@web/lib/agent-choice";
import { useState } from "react";

export function InstructionsPanel({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const update = useUpdateAgentProfile();
  const savedGuidance = profile.guidance ?? "";
  const [guidance, setGuidance] = useState(savedGuidance);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changed = guidance !== savedGuidance;

  async function save() {
    setSaveError(null);
    const normalizedGuidance = guidance.trim() || null;
    try {
      const updated = await update.mutateAsync({
        id: profile.id,
        request: requestForProfile(profile, descriptor, { guidance: normalizedGuidance }),
      });
      setGuidance(updated.guidance ?? "");
      toast.success("Instructions saved");
    } catch (error) {
      setSaveError(agentProfileErrorMessage(error));
    }
  }

  return (
    <div>
      <Field>
        <FieldLabel>Identity &amp; working style</FieldLabel>
        <p className="mb-2 text-xs leading-relaxed text-text-tertiary">
          These instructions are prepended to the agent’s first turn when a run launches.
        </p>
        <FieldControl>
          <Textarea
            aria-label="System guidance"
            className="min-h-50"
            maxLength={AGENT_PROFILE_GUIDANCE_MAX_LENGTH}
            value={guidance}
            onChange={(event) => setGuidance(event.target.value)}
            placeholder="Describe how this profile should approach its work."
          />
        </FieldControl>
      </Field>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="font-mono text-micro text-text-tertiary">
          {guidance.length.toLocaleString()} / {AGENT_PROFILE_GUIDANCE_MAX_LENGTH.toLocaleString()}
        </span>
        <div className="flex-1" />
        {changed ? (
          <Button variant="ghost" size="sm" onClick={() => setGuidance(savedGuidance)}>
            Reset
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          loading={update.isPending}
          disabled={!changed}
          onClick={() => void save()}
        >
          Save changes
        </Button>
      </div>
      {saveError ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
