import type { SkillContract } from "@otomat/domain";
import { Chip, Switch } from "@otomat/ui";
import { useSetSkillEnabled } from "@web/api/skills/mutations";
import { SkillDetails } from "@web/components/agents/agent-profile/shared/skill-details";
import { SKILL_INVALID_REASON_LABELS } from "@web/lib/skill-availability";
import { skillSourceRoot } from "@web/lib/skill-source";

export function SkillRow({ skill }: { skill: SkillContract }) {
  const setEnabled = useSetSkillEnabled();
  const root = skillSourceRoot(skill);
  const invalid = skill.status === "invalid";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{skill.name}</span>
          <span className="truncate font-mono text-micro text-text-tertiary">{root}</span>
          {invalid ? (
            <Chip tone="danger">
              {skill.invalid_reason ? SKILL_INVALID_REASON_LABELS[skill.invalid_reason] : "Invalid"}
            </Chip>
          ) : null}
          {!invalid && !skill.enabled ? <Chip tone="neutral">Disabled</Chip> : null}
        </div>
        {skill.description ? (
          <span className="truncate text-xs text-text-secondary">{skill.description}</span>
        ) : null}
        {setEnabled.isError ? (
          <p role="alert" className="text-xs text-danger">
            {setEnabled.error.message}
          </p>
        ) : null}
      </div>
      <SkillDetails skill={skill} />
      <Switch
        checked={skill.enabled}
        disabled={invalid || setEnabled.isPending}
        onCheckedChange={(enabled) => setEnabled.mutate({ id: skill.id, enabled })}
        aria-label={`${skill.name} · ${root}`}
      />
    </div>
  );
}
