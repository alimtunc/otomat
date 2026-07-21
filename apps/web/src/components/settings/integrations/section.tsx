import type {
  IssueSourceContract,
  LinearConnectionContract,
  LinearWorkspaceContract,
  ProjectContract,
} from "@otomat/domain";
import { Button, ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { useProjects } from "@web/api/daemon/queries";
import { useDisconnectLinear, useSyncLinear } from "@web/api/linear/mutations";
import { useIssueSources, useLinearConnection, useLinearWorkspace } from "@web/api/linear/queries";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { IssueSourcesList } from "@web/components/settings/integrations/issue-sources-list";
import { LinearConnectForm } from "@web/components/settings/integrations/linear-connect-form";
import { SectionHeading } from "@web/components/settings/section-heading";

type ConnectedLinear = Extract<LinearConnectionContract, { status: "connected" }>;

function ConnectionSummary({ connection }: { connection: ConnectedLinear }) {
  const disconnect = useDisconnectLinear();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{connection.workspace_name}</p>
        <p className="truncate text-xs text-text-tertiary">Connected as {connection.user_name}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={disconnect.isPending}
        onClick={() => disconnect.mutate()}
      >
        Disconnect
      </Button>
    </div>
  );
}

function ConnectionPanel({ connection }: { connection: LinearConnectionContract }) {
  if (connection.status === "connected") return <ConnectionSummary connection={connection} />;
  return <LinearConnectForm connectionError={connection.error_message} />;
}

function ConnectionQueryPanel({ query }: { query: UseQueryResult<LinearConnectionContract> }) {
  if (query.isPending) return <Skeleton className="h-14" />;
  if (query.isError) {
    return <ErrorState variant="inline" title="Could not read the Linear connection." />;
  }
  return <ConnectionPanel connection={query.data} />;
}

function IssueSourceSetup({
  connected,
  workspace,
  projects,
}: {
  connected: boolean;
  workspace: {
    data: LinearWorkspaceContract | undefined;
    isPending: boolean;
    isError: boolean;
  };
  projects: ProjectContract[];
}) {
  if (!connected) return null;
  if (workspace.isPending) {
    return <Skeleton className="m-3 h-28" />;
  }
  if (workspace.isError) {
    return <ErrorState variant="inline" title="Could not load Linear teams and projects." />;
  }
  if (workspace.data === undefined) return null;
  if (workspace.data.teams.length === 0) {
    return (
      <p className="border-t border-border-subtle p-3 text-xs text-text-tertiary">
        This Linear workspace has no teams available to map.
      </p>
    );
  }
  if (projects.length === 0) {
    return (
      <p className="border-t border-border-subtle p-3 text-xs text-text-tertiary">
        Register a repository first — a source needs a local project to import into.
      </p>
    );
  }
  return (
    <div className="border-t border-border-subtle">
      <IssueSourceForm workspace={workspace.data} projects={projects} />
    </div>
  );
}

function MappedSourcesPanel({
  projects,
  sources,
  connected,
  workspace,
}: {
  projects: UseQueryResult<ProjectContract[]>;
  sources: UseQueryResult<IssueSourceContract[]>;
  connected: boolean;
  workspace: {
    data: LinearWorkspaceContract | undefined;
    isPending: boolean;
    isError: boolean;
  };
}) {
  if (projects.isPending) return <Skeleton className="m-3 h-10" />;
  if (projects.isError) {
    return <ErrorState variant="inline" title="Could not load local projects." />;
  }
  return (
    <>
      <IssueSourcesList query={sources} projects={projects.data} />
      <IssueSourceSetup connected={connected} workspace={workspace} projects={projects.data} />
    </>
  );
}

export function IntegrationsSection() {
  const connection = useLinearConnection();
  const projects = useProjects();
  const connected =
    connection.isSuccess && connection.data.status === "connected" ? connection.data : null;
  const sources = useIssueSources(connected?.workspace_id ?? null);
  const workspace = useLinearWorkspace(connected?.workspace_id ?? null);
  const sync = useSyncLinear();
  const canSync = sources.isSuccess && sources.data.length > 0;

  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Mirror Linear issues into Otomat. The connection is read-only: nothing is written back to Linear."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          <ConnectionQueryPanel query={connection} />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Mapped sources</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={sync.isPending}
              disabled={connected === null || !canSync || sync.isPending}
              onClick={() => sync.mutate({})}
            >
              Sync now
            </Button>
          </div>
          <div className="rounded-lg border border-border-subtle bg-card">
            <MappedSourcesPanel
              key={connected?.workspace_id ?? ""}
              projects={projects}
              sources={sources}
              connected={connected !== null}
              workspace={workspace}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
