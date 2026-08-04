import { EmptyState, Skeleton } from "@otomat/ui";
import { ProjectRepositoryPanel } from "@web/components/settings/project/repository-panel";
import { ProjectSourcesPanel } from "@web/components/settings/project/sources-panel";
import { SectionHeading } from "@web/components/settings/section-heading";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import type { ReactNode } from "react";

export function ProjectSettingsSection() {
  const { projectId, projects } = useSelectedProject();
  const project = projects.data?.find((candidate) => candidate.id === projectId);

  let content: ReactNode;
  if (projects.isPending) {
    content = <Skeleton height={80} />;
  } else if (project === undefined) {
    content = (
      <EmptyState
        icon="folder-git-2"
        variant="inline"
        title="No project selected"
        description="Register a repository under global Repositories to create your first project."
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-6">
        <ProjectRepositoryPanel projectId={project.id} />
        <ProjectSourcesPanel project={project} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title={project ? `Project · ${project.name}` : "Project"}
        description="Settings scoped to the selected project: its repository, worktree init commands, and Linear issue sources."
      />
      <ProjectQueryBoundary query={projects}>{content}</ProjectQueryBoundary>
    </div>
  );
}
