import { SectionHeading } from "@web/components/settings/section-heading";
import { SkillCatalogPanel } from "@web/components/settings/skills/catalog-panel";
import { useActiveHostLabel } from "@web/lib/active-host";

export function SkillsSection() {
  const hostLabel = useActiveHostLabel();
  return (
    <div>
      <SectionHeading
        title="Skills"
        description="Skills discovered on this host. Each entry keeps its source file."
      />
      <SkillCatalogPanel
        owner={null}
        emptyTitle={`No skills on ${hostLabel}`}
        emptyDescription={`Otomat scans ~/.claude/skills on ${hostLabel} for your own skills. Add a SKILL.md there, then rescan.`}
      />
    </div>
  );
}
