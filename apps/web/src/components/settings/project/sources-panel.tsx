import type { ProjectContract } from "@otomat/domain";
import { ErrorState, Skeleton } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useIssueSources, useLinearConnections } from "@web/api/linear/queries";
import { useProjectLinearSync } from "@web/api/linear/use-project-sync";
import { LinearSyncControl } from "@web/components/issues/linear-sync/control";
import { ProjectSourcesCard } from "@web/components/settings/project/sources-card";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export function ProjectSourcesPanel({ project }: { project: ProjectContract }) {
  const connections = useLinearConnections();
  const sources = useIssueSources(project.id);
  const sync = useProjectLinearSync(project.id);
  const boundConnectionId = sources.data?.[0]?.connection_id ?? null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Linear sources</h2>
        {boundConnectionId === null ? null : <LinearSyncControl sync={sync} />}
      </div>
      <QueryBoundary
        query={connections}
        pending={<Skeleton className="h-20" />}
        error={<ErrorState variant="inline" title="Could not read the Linear connections." />}
        staleData="block"
      >
        {(catalogue) =>
          catalogue.length === 0 ? (
            <p className="text-xs text-text-tertiary">
              Connect a Linear workspace in{" "}
              <Link className="underline" to="/settings/integrations">
                global Integrations
              </Link>{" "}
              to map its teams into this project.
            </p>
          ) : (
            <ProjectSourcesCard
              project={project}
              catalogue={catalogue}
              sources={sources}
              boundConnectionId={boundConnectionId}
              sync={sync}
            />
          )
        }
      </QueryBoundary>
    </section>
  );
}
