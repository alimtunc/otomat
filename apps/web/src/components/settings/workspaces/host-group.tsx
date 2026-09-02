import type { ExecutionHostDescriptor, RemoteHostStatus, WorkspaceInventory } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { HostRow } from "@web/components/settings/execution-host/host-row";
import { ReconcileWorkspacesButton } from "@web/components/settings/workspaces/reconcile-button";
import { WorkspacesTable } from "@web/components/settings/workspaces/table";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { filterWorkspaces, type WorkspacesFilter } from "@web/lib/workspace/filter";

export interface WorkspaceHostGroupProps {
  host: ExecutionHostDescriptor;
  status: RemoteHostStatus | null;
  inventory: UseQueryResult<WorkspaceInventory>;
  filter: WorkspacesFilter;
}

export function WorkspaceHostGroup({ host, status, inventory, filter }: WorkspaceHostGroupProps) {
  return (
    <section className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
      <HostRow
        host={host}
        active
        status={status}
        action={<ReconcileWorkspacesButton hostId={host.id} />}
      />
      <QueryBoundary
        query={inventory}
        pending={<Skeleton height={120} />}
        error={
          <ErrorState
            variant="inline"
            title={`${host.label} did not answer`}
            description="Its daemon is not reachable, or refused to list its worktrees."
            onRetry={() => void inventory.refetch()}
          />
        }
      >
        {(data) => {
          const rows = filterWorkspaces(
            data.entries.map((entry) => ({ ...entry, host })),
            filter,
          );
          if (data.entries.length === 0) {
            return (
              <EmptyState
                icon="layers"
                variant="compact"
                title={`No worktree on ${host.label}`}
                description="Launch a run to fork this project's first isolated worktree."
              />
            );
          }
          if (rows.length === 0) {
            return (
              <p className="px-4.5 py-3 text-xs text-text-tertiary">
                {`No workspace on ${host.label} matches these filters.`}
              </p>
            );
          }
          return (
            <div className="overflow-auto">
              <WorkspacesTable rows={rows} />
            </div>
          );
        }}
      </QueryBoundary>
    </section>
  );
}
