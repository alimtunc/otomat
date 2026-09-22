import { EmptyState, ErrorState } from "@otomat/ui";
import { useRepositories } from "@web/api/daemon/queries";
import { ProjectExplorer } from "@web/components/files/project/explorer";
import { FilesTabs } from "@web/components/files/tabs";
import { FilesWorkspace } from "@web/components/files/workspace";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { SplitSkeleton } from "@web/components/shell/split-skeleton";

export function ProjectFilesView() {
  const { projectId } = useSelectedProject();
  const repositories = useRepositories(projectId);
  return (
    <RouteShell
      titleIcon="folder"
      breadcrumbs={[{ label: "Files", current: true }]}
      tabs={<FilesTabs />}
    >
      {projectId === undefined ? (
        <EmptyState
          icon="folder"
          title="No project selected"
          description="Add or select a project to browse its files."
        />
      ) : (
        <QueryList
          query={repositories}
          pending={<SplitSkeleton side={264} />}
          error={
            <ErrorState
              title="Could not load the repository"
              onRetry={() => void repositories.refetch()}
            />
          }
          empty={
            <EmptyState
              icon="folder"
              title="No repository"
              description="Connect a repository in project settings."
            />
          }
        >
          {([repository]) =>
            repository === undefined ? null : (
              <FilesWorkspace
                key={repository.id}
                target={{ kind: "repository", id: repository.id }}
              >
                <ProjectExplorer repositoryId={repository.id} />
              </FilesWorkspace>
            )
          }
        </QueryList>
      )}
    </RouteShell>
  );
}
