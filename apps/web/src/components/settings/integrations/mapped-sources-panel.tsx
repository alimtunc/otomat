import type { LinearWorkspaceContract, ProjectContract } from "@otomat/domain";
import { Button, ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useProjects } from "@web/api/daemon/queries";
import { useSyncLinear } from "@web/api/linear/mutations";
import { useIssueSources, useLinearWorkspace } from "@web/api/linear/queries";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { IssueSourcesList } from "@web/components/settings/integrations/issue-sources-list";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import type { ReactNode } from "react";

function SetupNote({ children }: { children: ReactNode }) {
  return <p className="border-t border-border-subtle p-3 text-xs text-text-tertiary">{children}</p>;
}

/** The mapping form, gated behind the Linear workspace load and the presence of both a team and a local project to bind. */
function IssueSourceSetup({
  workspace,
  projects,
}: {
  workspace: UseQueryResult<LinearWorkspaceContract>;
  projects: ProjectContract[];
}) {
  return (
    <QueryBoundary
      query={workspace}
      pending={<Skeleton className="m-3 h-28" />}
      error={<ErrorState variant="inline" title="Could not load Linear teams and projects." />}
    >
      {(data) => {
        if (data.teams.length === 0) {
          return <SetupNote>This Linear workspace has no teams available to map.</SetupNote>;
        }
        if (projects.length === 0) {
          return (
            <SetupNote>
              Register a repository first — a source needs a local project to import into.
            </SetupNote>
          );
        }
        return (
          <div className="border-t border-border-subtle">
            <IssueSourceForm workspace={data} projects={projects} />
          </div>
        );
      }}
    </QueryBoundary>
  );
}

/**
 * The mapped-sources concern in one place: it owns its own queries and sync
 * mutation, so the section above only tells it which workspace (if any) is
 * connected. Remounting on that id resets the mapping form.
 */
export function MappedSourcesPanel({ workspaceId }: { workspaceId: string | null }) {
  const projects = useProjects();
  const sources = useIssueSources(workspaceId);
  const workspace = useLinearWorkspace(workspaceId);
  const sync = useSyncLinear();
  const connected = workspaceId !== null;
  const canSync = sources.isSuccess && sources.data.length > 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Mapped sources</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={sync.isPending}
          disabled={!connected || !canSync || sync.isPending}
          onClick={() => sync.mutate({})}
        >
          Sync now
        </Button>
      </div>
      <div className="rounded-lg border border-border-subtle bg-card">
        <QueryBoundary
          query={projects}
          pending={<Skeleton className="m-3 h-10" />}
          error={<ErrorState variant="inline" title="Could not load local projects." />}
        >
          {(projectList) => (
            <>
              <IssueSourcesList query={sources} projects={projectList} />
              {connected ? <IssueSourceSetup workspace={workspace} projects={projectList} /> : null}
            </>
          )}
        </QueryBoundary>
      </div>
    </section>
  );
}
