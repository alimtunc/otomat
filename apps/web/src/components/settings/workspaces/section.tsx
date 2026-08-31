import { countWorkspaces, type ExecutionHostDescriptor, type WorkspaceState } from "@otomat/domain";
import { Icon, Input, Skeleton } from "@otomat/ui";
import { useHostWorkspaces } from "@web/api/workspaces/queries";
import { SectionHeading } from "@web/components/settings/section-heading";
import { AutoDeleteWorkspacesRow } from "@web/components/settings/workspaces/auto-delete-row";
import { BulkCleanupWorkspacesButton } from "@web/components/settings/workspaces/bulk-cleanup-button";
import { WorkspaceCounters } from "@web/components/settings/workspaces/counters";
import { WorkspaceHostGroup } from "@web/components/settings/workspaces/host-group";
import { useHostSnapshot } from "@web/components/shell/remote-session/use-host-snapshot";
import { DEFAULT_WORKSPACES_FILTER } from "@web/lib/workspace/filter";
import { useState } from "react";

const LOCAL_ONLY: ExecutionHostDescriptor[] = [{ id: "local", label: "Local", kind: "local" }];

export function WorkspacesSection() {
  const snapshot = useHostSnapshot();
  const hosts = snapshot.data?.hosts ?? LOCAL_ONLY;
  const inventories = useHostWorkspaces(hosts);
  const [filter, setFilter] = useState(DEFAULT_WORKSPACES_FILTER);
  const rows = hosts.flatMap((host, index) =>
    (inventories[index].data?.entries ?? []).map((entry) => ({ ...entry, host })),
  );
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
        description="Every worktree Otomat holds, on every configured host, reconciled against real git state: what is active, what may be deleted, and what Otomat leaves alone."
      />
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border-subtle bg-card px-4">
          <AutoDeleteWorkspacesRow />
        </div>
        {snapshot.isError && snapshot.data === undefined ? (
          <p role="alert" className="text-xs text-danger">
            Could not read the configured hosts — showing this machine only.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {inventories.every((host) => host.isPending) ? (
            <Skeleton height={22} width={320} />
          ) : (
            <WorkspaceCounters
              counts={countWorkspaces(rows)}
              selected={filter.states}
              onToggle={toggleState}
            />
          )}
          <BulkCleanupWorkspacesButton rows={rows} />
          <Input
            value={filter.search}
            icon={<Icon name="search" aria-hidden />}
            placeholder="Search host, issue, branch, path or repository"
            aria-label="Search workspaces"
            className="min-w-44 flex-1"
            onChange={(event) => setFilter({ ...filter, search: event.target.value })}
          />
        </div>
        {hosts.map((host, index) => (
          <WorkspaceHostGroup
            key={host.id}
            host={host}
            active={host.id === (snapshot.data?.active_id ?? "local")}
            status={host.kind === "ssh" ? (snapshot.data?.remote_status ?? null) : null}
            inventory={inventories[index]}
            filter={filter}
          />
        ))}
      </div>
    </div>
  );
}
