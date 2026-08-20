import { Button, Chip, Icon } from "@otomat/ui";
import { skillAvailabilityLabel, type SkillAvailability } from "@web/lib/skill-availability";

export function ActivatedSkillCard({
  skillId,
  availability,
  hostLabel,
  disabled,
  onRemove,
}: {
  skillId: string;
  availability: SkillAvailability;
  hostLabel: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { skill, status } = availability;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5">
      <Icon name="book" aria-hidden className="size-3.75 flex-none text-text-tertiary" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {skill?.name ?? skillId}
          </span>
          {skill ? <Chip tone="ghost">{skill.source}</Chip> : null}
          <Chip tone={status === "available" ? "success" : "warning"}>
            {skillAvailabilityLabel(availability, hostLabel)}
          </Chip>
        </div>
        <p className="truncate text-xs text-text-tertiary">
          {skill?.description ?? "Configured on this profile, but no longer discoverable."}
        </p>
        {skill ? (
          <p className="truncate text-micro text-text-tertiary">{skill.canonical_path}</p>
        ) : null}
      </div>
      <Button variant="ghost" size="xs" disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
