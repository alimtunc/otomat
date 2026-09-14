import { Skeleton } from "@otomat/ui";
import { NoProjectSelectedState } from "@web/components/settings/project/no-project-selected-state";
import { SectionHeading } from "@web/components/settings/section-heading";
import { SkillCatalogPanel } from "@web/components/settings/skills/catalog-panel";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import type { ReactNode } from "react";

export function ProjectSkillsSection() {
  const { projectId, projects } = useSelectedProject();

  let content: ReactNode;
  if (projects.isPending) {
    content = <Skeleton height={80} />;
  } else if (projectId === undefined) {
    content = <NoProjectSelectedState icon="book" />;
  } else {
    content = (
      <SkillCatalogPanel
        owner={projectId}
        emptyTitle="No skills in this repository"
        emptyDescription="Add a SKILL.md under .agents/skills or .claude/skills in the project, then rescan."
      />
    );
  }

  return (
    <div>
      <SectionHeading
        title="Project · Skills"
        description="Skills discovered on this host. Each entry keeps its source file."
      />
      <ProjectQueryBoundary query={projects}>{content}</ProjectQueryBoundary>
    </div>
  );
}
