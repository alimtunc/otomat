import { EmptyState, ErrorState, Spinner } from "@otomat/ui";
import { useRepositories } from "@web/api/daemon/queries";
import { ProjectExplorer } from "@web/components/files/project/explorer";
import { FilesWorkspace } from "@web/components/files/workspace";
import { CenteredState } from "@web/components/shell/centered-state";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { RouteShell } from "@web/components/shell/route-shell";

export function ProjectFilesView() {
  const { projectId } = useSelectedProject();
  const repositories = useRepositories(projectId);
  return (
    <RouteShell active="files" titleIcon="folder" breadcrumbs={[{ label: "Files", current: true }]}>
      {projectId === undefined ? (
        <EmptyState
          icon="folder"
          title="No project selected"
          description="Add or select a project to browse its files."
        />
      ) : (
        <QueryBoundary
          query={repositories}
          pending={
            <CenteredState>
              <Spinner label="Loading repository" />
            </CenteredState>
          }
          error={
            <ErrorState
              title="Could not load the repository"
              onRetry={() => void repositories.refetch()}
            />
          }
        >
          {(entries) =>
            entries[0] === undefined ? (
              <EmptyState
                icon="folder"
                title="No repository"
                description="Connect a repository in project settings."
              />
            ) : (
              <FilesWorkspace
                key={entries[0].id}
                target={{ kind: "repository", id: entries[0].id }}
              >
                <ProjectExplorer repositoryId={entries[0].id} />
              </FilesWorkspace>
            )
          }
        </QueryBoundary>
      )}
    </RouteShell>
  );
}
