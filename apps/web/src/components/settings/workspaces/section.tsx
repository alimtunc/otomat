import type { WorkspaceState } from "@otomat/domain";
import { EmptyState, ErrorState, Icon, Input, Skeleton } from "@otomat/ui";
import { useWorkspaces } from "@web/api/workspaces/queries";
import { SectionHeading } from "@web/components/settings/section-heading";
import { AutoDeleteWorkspacesRow } from "@web/components/settings/workspaces/auto-delete-row";
import { WorkspaceCounters } from "@web/components/settings/workspaces/counters";
import { ReconcileWorkspacesButton } from "@web/components/settings/workspaces/reconcile-button";
import { WorkspacesTable } from "@web/components/settings/workspaces/table";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import {
  DEFAULT_WORKSPACES_FILTER,
  filterWorkspaces,
  groupWorkspacesByRepository,
} from "@web/lib/workspace/filter";
import { useState } from "react";

export function WorkspacesSection() {
  const workspaces = useWorkspaces();
  const [filter, setFilter] = useState(DEFAULT_WORKSPACES_FILTER);
  const toggleState = (state: WorkspaceState): void => {
    setFilter((current) => ({
      ...current,
      states: current.states.includes(state)
        ? current.states.filter((kept) => kept !== state)
        : [...current.states, state],
    }));
  };

  return (
    <div>
      <SectionHeading
        title="Workspaces"
        description="Every worktree this host holds, reconciled against real git state: what is active, what may be deleted, and what Otomat leaves alone."
      />
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border-subtle bg-card px-4">
          <AutoDeleteWorkspacesRow />
        </div>
        <QueryBoundary
          query={workspaces}
          pending={<Skeleton height={120} />}
          error={
            <ErrorState
              variant="inline"
              title="Couldn’t read the worktrees"
              onRetry={() => void workspaces.refetch()}
            />
          }
        >
          {(inventory) => {
            const groups = groupWorkspacesByRepository(filterWorkspaces(inventory.entries, filter));
            return (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <WorkspaceCounters
                    counts={inventory.counts}
                    selected={filter.states}
                    onToggle={toggleState}
                  />
                  <ReconcileWorkspacesButton />
                </div>
                <Input
                  value={filter.search}
                  icon={<Icon name="search" aria-hidden />}
                  placeholder="Search issue, branch, path or repository"
                  aria-label="Search workspaces"
                  onChange={(event) => setFilter({ ...filter, search: event.target.value })}
                />
                <div className="overflow-auto rounded-lg border border-border-subtle bg-card">
                  {inventory.entries.length === 0 ? (
                    <EmptyState
                      icon="layers"
                      variant="inline"
                      title="No worktrees"
                      description="Launch a run to fork the first isolated worktree of this host."
                    />
                  ) : null}
                  {inventory.entries.length > 0 && groups.length === 0 ? (
                    <p className="px-4.5 py-6 text-sm text-text-tertiary">
                      No workspace matches these filters.
                    </p>
                  ) : null}
                  {groups.length > 0 ? <WorkspacesTable groups={groups} /> : null}
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </div>
  );
}
