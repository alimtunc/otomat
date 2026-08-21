import type { ExecutionHostRepositoriesEntry } from "@otomat/domain";
import { EmptyState, ErrorState } from "@otomat/ui";
import { HostRow } from "@web/components/settings/execution-host/host-row";
import { RepositoryRow } from "@web/components/settings/repositories/row";
import type { ReactNode } from "react";

export function RepositoryHostGroup({ entry }: { entry: ExecutionHostRepositoriesEntry }) {
  let rows: ReactNode;
  if (entry.repositories === null) {
    rows = (
      <ErrorState
        variant="inline"
        title={`${entry.host.label} did not answer`}
        description="Its daemon is not reachable, or refused to list its repositories."
      />
    );
  } else if (entry.repositories.length === 0) {
    rows = (
      <EmptyState
        icon="folder-git-2"
        variant="inline"
        title={`No repository on ${entry.host.label}`}
        description="Add one to give this host a project agents can fork worktrees from."
      />
    );
  } else {
    rows = (
      <ul className="flex flex-col divide-y divide-border-subtle">
        {entry.repositories.map((repository) => (
          <RepositoryRow key={repository.id} hostId={entry.host.id} repository={repository} />
        ))}
      </ul>
    );
  }

  return (
    <section className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-card">
      <HostRow host={entry.host} active={entry.active} status={entry.status} />
      {rows}
    </section>
  );
}
