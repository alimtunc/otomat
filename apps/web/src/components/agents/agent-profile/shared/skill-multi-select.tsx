import type { SkillContract } from "@otomat/domain";
import { Checkbox, Chip, cn, Icon, Input } from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { SkillDetails } from "@web/components/agents/agent-profile/shared/skill-details";
import { filterSkills, skillSourceRoot } from "@web/lib/skill-source";
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
  const form = useForm({ defaultValues: { search: "" } });
  const search = useStore(form.store, (state) => state.values.search);
  const matching = filterSkills(skills, search);
  if (skills.length === 0) {
    return (
      <p className="text-xs text-text-tertiary">
        No skills discovered. Add SKILL.md files and rescan on the Skills page.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form.Field name="search">
        {(field) => (
          <Input
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
            onBlur={field.handleBlur}
            aria-label="Search skills"
            placeholder="Search name, description or path"
            icon={<Icon name="search" />}
          />
        )}
      </form.Field>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border-subtle bg-card p-1.5">
        {matching.map((skill) => {
          const root = skillSourceRoot(skill);
          const isSelected = selected.has(skill.id);
          const selectable =
            !disabled && ((skill.status === "available" && skill.enabled) || isSelected);
          return (
            <div
              key={skill.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-hover",
                !selectable && "cursor-not-allowed opacity-50",
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-[inherit] items-center gap-2.5">
                <Checkbox
                  aria-label={`${skill.name} · ${root}`}
                  checked={isSelected}
                  disabled={!selectable}
                  onCheckedChange={() => onToggle(skill.id)}
                />
                <Icon name="book" aria-hidden className="size-3.5 flex-none text-text-tertiary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {skill.name}{" "}
                    <span className="font-mono text-micro font-normal text-text-tertiary">
                      {root}
                    </span>
                  </span>
                  {skill.description ? (
                    <span className="block truncate text-xs text-text-tertiary">
                      {skill.description}
                    </span>
                  ) : null}
                </span>
              </label>
              <SkillDetails skill={skill} />
              {skillStatusBadge(skill)}
            </div>
          );
        })}
        {matching.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-text-tertiary">No skills match this search.</p>
        ) : null}
      </div>
    </div>
  );
}
