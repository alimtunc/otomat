import type { SkillContract } from "@otomat/domain";
import { Button, CopyButton, Popover, PopoverContent, PopoverTrigger } from "@otomat/ui";
import { skillSourceRoot } from "@web/lib/skill-source";

export function SkillDetails({ skill }: { skill: SkillContract }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Details for ${skill.name} · ${skillSourceRoot(skill)}`}
          >
            Details
          </Button>
        }
      />
      <PopoverContent className="flex max-w-sm flex-col gap-2 p-3">
        <p className="text-sm font-medium">{skill.name}</p>
        <p className="text-xs text-text-secondary">
          {skill.description ?? "No description reported."}
        </p>
        <div className="flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all text-xs">{skill.canonical_path}</code>
          <CopyButton value={skill.canonical_path} label="Copy skill path" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
