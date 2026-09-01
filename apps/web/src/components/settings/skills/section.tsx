import { SectionHeading } from "@web/components/settings/section-heading";
import { SkillCatalogPanel } from "@web/components/settings/skills/catalog-panel";

export function SkillsSection() {
  return (
    <div>
      <SectionHeading
        title="Skills"
        description="Your own skills, discovered in ~/.claude/skills; never executed by Otomat. Every agent may activate them. A repository's own skills live under Project · Skills."
      />
      <SkillCatalogPanel
        owner={null}
        emptyTitle="No skills found"
        emptyDescription="Otomat scans ~/.claude/skills for your own skills. Add a SKILL.md there, then rescan."
      />
    </div>
  );
}
