import type { LinearConnectionContract } from "@otomat/domain";
import { Button, ErrorState, Skeleton } from "@otomat/ui";
import { useProjects } from "@web/api/daemon/queries";
import { useDisconnectLinear, useSyncLinear } from "@web/api/linear/mutations";
import { useIssueSources, useLinearConnection, useLinearWorkspace } from "@web/api/linear/queries";
import { IssueSourceForm } from "@web/components/settings/integrations/issue-source-form";
import { IssueSourcesList } from "@web/components/settings/integrations/issue-sources-list";
import { LinearConnectForm } from "@web/components/settings/integrations/linear-connect-form";
import { SectionHeading } from "@web/components/settings/section-heading";

function ConnectionSummary({ connection }: { connection: LinearConnectionContract }) {
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
  return (
    <>
      {connection.error_message === null ? null : (
        <p role="alert" className="text-xs text-danger">
          {connection.error_message}
        </p>
      )}
      <LinearConnectForm />
    </>
  );
}

export function IntegrationsSection() {
  const connection = useLinearConnection();
  const projects = useProjects();
  const sources = useIssueSources();
  const connected = connection.data?.status === "connected";
  const workspace = useLinearWorkspace(connected);
  const sync = useSyncLinear();

  return (
    <div>
      <SectionHeading
        title="Integrations"
        description="Mirror Linear issues into Otomat. The connection is read-only: nothing is written back to Linear."
      />
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Linear</h2>
          {connection.isPending ? <Skeleton className="h-14" /> : null}
          {connection.isError ? (
            <ErrorState variant="inline" title="Could not read the Linear connection." />
          ) : null}
          {connection.data === undefined ? null : <ConnectionPanel connection={connection.data} />}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Mapped sources</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={sync.isPending}
              disabled={!connected || sync.isPending}
              onClick={() => sync.mutate({})}
            >
              Sync now
            </Button>
          </div>
          <div className="rounded-lg border border-border-subtle bg-card">
            <IssueSourcesList query={sources} projects={projects.data ?? []} />
            {connected && workspace.data !== undefined ? (
              <div className="border-t border-border-subtle">
                <IssueSourceForm workspace={workspace.data} projects={projects.data ?? []} />
              </div>
            ) : null}
          </div>
          {connected && workspace.isError ? (
            <ErrorState variant="inline" title="Could not load Linear teams and projects." />
          ) : null}
        </section>
      </div>
    </div>
  );
}
