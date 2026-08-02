import type { ProjectContract } from "@otomat/domain";
import { Button, ErrorState, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useSyncLinear } from "@web/api/linear/mutations";
import { useIssueSources, useLinearConnection, useLinearWorkspace } from "@web/api/linear/queries";
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
  const sync = useSyncLinear();
  const projectSources = {
    ...sources,
    data: sources.data?.filter((source) => source.project_id === project.id),
  } as typeof sources;
  const canSync = (projectSources.data?.length ?? 0) > 0;

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
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={sync.isPending}
          disabled={!canSync || sync.isPending}
          onClick={() => sync.mutate({ project_id: project.id })}
        >
          Sync this project
        </Button>
      </div>
      <div className="rounded-lg border border-border-subtle bg-card">
        <IssueSourcesList query={projectSources} projects={[project]} removable />
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
                <IssueSourceForm key={workspaceId} workspace={data} projects={[project]} />
              </div>
            )
          }
        </QueryBoundary>
      </div>
    </section>
  );
}
