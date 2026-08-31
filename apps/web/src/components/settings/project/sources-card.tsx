import type {
  IssueSourceContract,
  LinearConnectionContract,
  ProjectContract,
} from "@otomat/domain";
import { ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useLinearWorkspace } from "@web/api/linear/queries";
import type { ProjectLinearSync } from "@web/api/linear/use-project-sync";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { MappingField } from "@web/components/settings/integrations/issue-source-form/mapping-field";
import { IssueSourcesList } from "@web/components/settings/integrations/issue-sources-list";
import { ConnectionUnavailable } from "@web/components/settings/project/connection-unavailable";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useState } from "react";

export interface ProjectSourcesCardProps {
  project: ProjectContract;
  catalogue: LinearConnectionContract[];
  sources: UseQueryResult<IssueSourceContract[]>;
  /** The connection this project already reads from; null while it maps none. */
  boundConnectionId: string | null;
  sync: ProjectLinearSync;
}

export function ProjectSourcesCard({
  project,
  catalogue,
  sources,
  boundConnectionId,
  sync,
}: ProjectSourcesCardProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const connectionId = boundConnectionId ?? picked ?? catalogue[0]?.id ?? "";
  const connection = catalogue.find((candidate) => candidate.id === connectionId) ?? null;
  const workspace = useLinearWorkspace(connection?.status === "connected" ? connectionId : null);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3">
      <MappingField
        label="Linear connection"
        value={connectionId}
        options={catalogue.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
        disabled={boundConnectionId !== null}
        onValueChange={setPicked}
      />
      <IssueSourcesList
        query={sources}
        projects={[project]}
        teams={workspace.data?.teams ?? []}
        removable
      />
      {connection?.status === "connected" ? (
        <QueryBoundary
          query={workspace}
          pending={<Skeleton className="h-28" />}
          error={<ErrorState variant="inline" title="Could not load this connection's teams." />}
        >
          {(data) =>
            data.teams.length === 0 ? (
              <p className="text-xs text-text-tertiary">
                This Linear workspace has no teams available to map.
              </p>
            ) : (
              <IssueSourceForm
                key={`${connectionId}:${project.id}`}
                workspace={data}
                connectionId={connectionId}
                projects={[project]}
                onCreated={() => sync.refresh({ announce: true })}
              />
            )
          }
        </QueryBoundary>
      ) : (
        <ConnectionUnavailable connectionId={connectionId} connection={connection} />
      )}
    </div>
  );
}
