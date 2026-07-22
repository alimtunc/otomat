import type { SkillContract } from "@otomat/domain";
import { Button, Chip, Icon } from "@otomat/ui";

export function ActivatedSkillCard({
  skillId,
  skill,
  disabled,
  onRemove,
}: {
  skillId: string;
  skill: SkillContract | undefined;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-card p-3.5">
      <Icon name="book" aria-hidden className="size-3.75 flex-none text-text-tertiary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {skill?.name ?? skillId}
          </span>
          {skill ? (
            <Chip tone="ghost">{skill.source}</Chip>
          ) : (
            <Chip tone="warning">Unavailable</Chip>
          )}
        </div>
        <p className="truncate text-xs text-text-tertiary">
          {skill?.description ?? "This configured skill is no longer in the catalog."}
        </p>
      </div>
      <Button variant="ghost" size="xs" disabled={disabled} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
