import type { SkillContract } from "@otomat/domain";
import { Badge, Chip, Switch } from "@otomat/ui";
import { useSetSkillEnabled } from "@web/api/skills/mutations";
import { SKILL_INVALID_REASON_LABELS } from "@web/lib/skill-availability";

export function SkillRow({ skill }: { skill: SkillContract }) {
  const setEnabled = useSetSkillEnabled();
  const invalid = skill.status === "invalid";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{skill.name}</span>
          <Badge variant="default">{skill.source}</Badge>
          {invalid ? (
            <Chip tone="danger">
              {skill.invalid_reason ? SKILL_INVALID_REASON_LABELS[skill.invalid_reason] : "Invalid"}
            </Chip>
          ) : (
            <Badge variant="iris">Available</Badge>
          )}
        </div>
        {skill.description ? (
          <span className="truncate text-xs text-text-secondary">{skill.description}</span>
        ) : null}
        <span className="truncate text-micro text-text-tertiary">{skill.canonical_path}</span>
      </div>
      <Switch
        checked={skill.enabled}
        disabled={invalid || setEnabled.isPending}
        onCheckedChange={(enabled) => setEnabled.mutate({ id: skill.id, enabled })}
        aria-label={`Enable ${skill.name}`}
      />
    </div>
  );
}
