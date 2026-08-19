import type { ProjectContract } from "@otomat/domain";
import { ErrorState, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useIssueSources, useLinearConnection, useLinearWorkspace } from "@web/api/linear/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { IssueSourcesList } from "@web/components/settings/integrations/issue-sources-list";
import { QueryBoundary } from "@web/components/shell/query-boundary";

/** The selected project's Linear sources: scoped list, unmap, add, and a project-only sync. */
export function ProjectSourcesPanel({ project }: { project: ProjectContract }) {
  const connection = useLinearConnection();
  const workspaceId =
    connection.isSuccess && connection.data.status === "connected"
      ? connection.data.workspace_id
      : null;
  const sources = useIssueSources(workspaceId);
  const workspace = useLinearWorkspace(workspaceId);
  const sync = useProjectLinearSync(project.id);
  // SAFETY: only data is narrowed to this project; the query surface is forwarded unchanged.
  const projectSources = {
    ...sources,
    data: sources.data?.filter((source) => source.project_id === project.id),
  } as typeof sources;

  if (workspaceId === null) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Linear sources</h2>
        <p className="text-xs text-text-tertiary">
          Connect Linear in{" "}
          <Link className="underline" to="/settings/integrations">
            global Integrations
          </Link>{" "}
          to map its teams into this project.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Linear sources</h2>
        <LinearSyncControl sync={sync} />
      </div>
      <div className="rounded-lg border border-border-subtle bg-card">
        <IssueSourcesList
          query={projectSources}
          projects={[project]}
          teams={workspace.data?.teams ?? []}
          removable
        />
        <QueryBoundary
          query={workspace}
          pending={<Skeleton className="m-3 h-28" />}
          error={<ErrorState variant="inline" title="Could not load Linear teams and projects." />}
        >
          {(data) =>
            data.teams.length === 0 ? (
              <p className="border-t border-border-subtle p-3 text-xs text-text-tertiary">
                This Linear workspace has no teams available to map.
              </p>
            ) : (
              <div className="border-t border-border-subtle">
                <IssueSourceForm
                  key={`${workspaceId}:${project.id}`}
                  workspace={data}
                  projects={[project]}
                  onCreated={() => sync.refresh({ announce: true })}
                />
              </div>
            )
          }
        </QueryBoundary>
      </div>
    </section>
  );
}
