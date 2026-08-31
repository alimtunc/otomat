import type { ExecutionHostDescriptor, RemoteHostStatus, WorkspaceInventory } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton } from "@otomat/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { HostRow } from "@web/components/settings/execution-host/host-row";
import { ReconcileWorkspacesButton } from "@web/components/settings/workspaces/reconcile-button";
import { WorkspacesTable } from "@web/components/settings/workspaces/table";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import {
  filterWorkspaces,
  groupWorkspacesByRepository,
  type WorkspacesFilter,
} from "@web/lib/workspace/filter";

export interface WorkspaceHostGroupProps {
  host: ExecutionHostDescriptor;
  active: boolean;
  status: RemoteHostStatus | null;
  inventory: UseQueryResult<WorkspaceInventory>;
  filter: WorkspacesFilter;
}

export function WorkspaceHostGroup({
  host,
  active,
  status,
  inventory,
  filter,
}: WorkspaceHostGroupProps) {
  return (
    <section className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
      <HostRow
        host={host}
        active={active}
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
          const rows = data.entries.map((entry) => ({ ...entry, host }));
          const groups = groupWorkspacesByRepository(filterWorkspaces(rows, filter));
          if (rows.length === 0) {
            return (
              <EmptyState
                icon="layers"
                variant="inline"
                title={`No worktree on ${host.label}`}
                description="Launch a run to fork the first isolated worktree of this host."
              />
            );
          }
          if (groups.length === 0) {
            return (
              <p className="px-4.5 py-6 text-sm text-text-tertiary">
                {`No workspace on ${host.label} matches these filters.`}
              </p>
            );
          }
          return (
            <div className="overflow-auto">
              <WorkspacesTable groups={groups} />
            </div>
          );
        }}
      </QueryBoundary>
    </section>
  );
}
