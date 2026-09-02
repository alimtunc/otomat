import { countWorkspaces, type ExecutionHostDescriptor, type WorkspaceState } from "@otomat/domain";
import { Icon, Input, Skeleton } from "@otomat/ui";
import { useProjectWorkspaces } from "@web/api/workspaces/queries";
import { NoProjectSelectedState } from "@web/components/settings/project/no-project-selected-state";
import { SectionHeading } from "@web/components/settings/section-heading";
import { AutoDeleteWorkspacesRow } from "@web/components/settings/workspaces/auto-delete-row";
import { BulkCleanupStrip } from "@web/components/settings/workspaces/bulk-cleanup-strip";
import { WorkspaceCounters } from "@web/components/settings/workspaces/counters";
import { WorkspaceHostGroup } from "@web/components/settings/workspaces/host-group";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useHostSnapshot } from "@web/components/shell/remote-session/use-host-snapshot";
import { useActiveHostId, useActiveHostLabel } from "@web/lib/active-host";
import { DEFAULT_WORKSPACES_FILTER } from "@web/lib/workspace/filter";
import { useState, type ReactNode } from "react";

export function WorkspacesSection() {
  const { projectId, projects } = useSelectedProject();
  const hostId = useActiveHostId();
  const hostLabel = useActiveHostLabel();
  const snapshot = useHostSnapshot();
  const workspaces = useProjectWorkspaces(projectId);
  const [filter, setFilter] = useState(DEFAULT_WORKSPACES_FILTER);
  const host: ExecutionHostDescriptor = {
    id: hostId,
    label: hostLabel,
    kind: hostId === "local" ? "local" : "ssh",
  };
  const rows = (workspaces.data?.entries ?? []).map((entry) => ({ ...entry, host }));
  const toggleState = (state: WorkspaceState): void => {
    setFilter((current) => ({
      ...current,
      states: current.states.includes(state)
        ? current.states.filter((kept) => kept !== state)
        : [...current.states, state],
    }));
  };

  let content: ReactNode;
  if (projects.isPending) {
    content = <Skeleton height={160} />;
  } else if (projectId === undefined) {
    content = <NoProjectSelectedState icon="layers" />;
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border-subtle bg-card px-4">
          <AutoDeleteWorkspacesRow projectId={projectId} />
        </div>
        <BulkCleanupStrip rows={rows} />
        <div className="flex flex-wrap items-center gap-2">
          {workspaces.isPending ? (
            <Skeleton height={22} width={320} />
          ) : (
            <WorkspaceCounters
              counts={countWorkspaces(rows)}
              selected={filter.states}
              onToggle={toggleState}
            />
          )}
          <Input
            value={filter.search}
            icon={<Icon name="search" aria-hidden />}
            placeholder="Search issue, branch, path or host"
            aria-label="Search workspaces"
            className="min-w-44 flex-1"
            onChange={(event) => setFilter({ ...filter, search: event.target.value })}
          />
        </div>
        <WorkspaceHostGroup
          host={host}
          status={hostId === "local" ? null : (snapshot.data?.remote_status ?? null)}
          inventory={workspaces}
          filter={filter}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Workspaces"
        description="The worktrees this project holds on its host, reconciled against real git state."
      />
      <ProjectQueryBoundary query={projects}>{content}</ProjectQueryBoundary>
    </div>
  );
}
