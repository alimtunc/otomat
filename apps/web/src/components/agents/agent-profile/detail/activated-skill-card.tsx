import {
  Chip,
  Icon,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@otomat/ui";
import { SkillDetails } from "@web/components/agents/agent-profile/shared/skill-details";
import { skillAvailabilityLabel, type SkillAvailability } from "@web/lib/skill-availability";
import { skillSourceRoot } from "@web/lib/skill-source";

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
          {skill ? (
            <span className="font-mono text-micro text-text-tertiary">
              {skillSourceRoot(skill)}
            </span>
          ) : null}
          {status === "available" ? null : (
            <Chip tone="warning">{skillAvailabilityLabel(availability, hostLabel)}</Chip>
          )}
        </div>
        <p className="truncate text-xs text-text-tertiary">
          {skill?.description ?? "Configured on this profile, but no longer discoverable."}
        </p>
      </div>
      {skill === null ? null : <SkillDetails skill={skill} />}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              size="sm"
              disabled={disabled}
              label={`Actions for ${skill?.name ?? skillId}`}
              icon={<Icon name="more-horizontal" />}
            />
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={disabled} onClick={onRemove}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
