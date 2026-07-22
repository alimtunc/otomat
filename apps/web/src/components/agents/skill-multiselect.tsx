import type { SkillContract } from "@otomat/domain";
import { Checkbox, Chip, cn, Icon } from "@otomat/ui";
import type { ReactNode } from "react";

export interface SkillMultiSelectProps {
  skills: SkillContract[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}

function skillStatusBadge(skill: SkillContract): ReactNode {
  if (skill.status !== "available") {
    return <Chip tone="danger">Invalid</Chip>;
  }
  if (!skill.enabled) return <Chip tone="neutral">Disabled</Chip>;
  return null;
}

export function SkillMultiSelect({
  skills,
  selectedIds,
  onToggle,
  disabled = false,
}: SkillMultiSelectProps) {
  const selected = new Set(selectedIds);
  if (skills.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No skills discovered. Add SKILL.md files and rescan on the Skills page.
      </p>
    );
  }
  return (
    <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border-subtle bg-card p-1.5">
      {skills.map((skill) => {
        const isSelected = selected.has(skill.id);
        const selectable =
          !disabled && ((skill.status === "available" && skill.enabled) || isSelected);
        return (
          <label
            key={skill.id}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-hover",
              !selectable && "cursor-not-allowed opacity-50",
            )}
          >
            <Checkbox
              checked={isSelected}
              disabled={!selectable}
              onCheckedChange={() => onToggle(skill.id)}
            />
            <Icon name="book" aria-hidden className="size-3.5 flex-none text-text-tertiary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{skill.name}</span>
              {skill.description ? (
                <span className="block truncate text-xs text-text-tertiary">
                  {skill.description}
                </span>
              ) : null}
            </span>
            <Chip tone="ghost">{skill.source}</Chip>
            {skillStatusBadge(skill)}
          </label>
        );
      })}
    </div>
  );
}
