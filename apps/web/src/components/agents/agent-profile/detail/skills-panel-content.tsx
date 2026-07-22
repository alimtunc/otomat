import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { Chip, EmptyState, toast } from "@otomat/ui";
import { agentProfileErrorMessage, useUpdateAgentProfile } from "@web/api/agent-profiles/mutations";
import { ActivatedSkillCard } from "@web/components/agents/agent-profile/detail/activated-skill-card";
import { SkillMultiSelect } from "@web/components/agents/agent-profile/shared/skill-multi-select";
import { requestForProfile } from "@web/lib/agent-choice";
import { useState } from "react";

export function SkillsPanelContent({
  profile,
  descriptor,
  skills,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
  skills: SkillContract[];
}) {
  const update = useUpdateAgentProfile();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function toggleSkill(skillId: string) {
    if (update.isPending) return;
    setSaveError(null);
    const selected = profile.skill_ids.includes(skillId);
    const skillIds = selected
      ? profile.skill_ids.filter((id) => id !== skillId)
      : [...profile.skill_ids, skillId];
    try {
      await update.mutateAsync({
        id: profile.id,
        request: requestForProfile(profile, descriptor, { skill_ids: skillIds }),
      });
      toast.success(selected ? "Skill removed" : "Skill added");
    } catch (error) {
      setSaveError(agentProfileErrorMessage(error));
    }
  }

  return (
    <div className="flex max-w-180 flex-col gap-4">
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Activated skills</h3>
          <Chip tone="neutral">{profile.skill_ids.length}</Chip>
        </div>
        {profile.skill_ids.length > 0 ? (
          <div className="flex flex-col gap-2">
            {profile.skill_ids.map((skillId) => (
              <ActivatedSkillCard
                key={skillId}
                skillId={skillId}
                skill={skills.find((skill) => skill.id === skillId)}
                disabled={update.isPending}
                onRemove={() => void toggleSkill(skillId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="book"
            variant="compact"
            title="No activated skills"
            description="Choose skills from the catalog below."
            className="rounded-lg border border-border-subtle bg-card"
          />
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Skill catalog</h3>
        <p className="mb-2.5 text-xs leading-relaxed text-text-tertiary">
          Enabled local instructions this profile can activate when a run launches.
        </p>
        <SkillMultiSelect
          skills={skills}
          selectedIds={profile.skill_ids}
          disabled={update.isPending}
          onToggle={(skillId) => void toggleSkill(skillId)}
        />
      </section>
      {saveError ? (
        <p role="alert" className="text-xs text-danger">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
