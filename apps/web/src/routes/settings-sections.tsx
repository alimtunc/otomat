import type { RepositoryContract } from "@otomat/domain";
import { EmptyState, ErrorState, Skeleton, type ConnectionState } from "@otomat/ui";
import { Bot, FolderGit2, Terminal } from "lucide-react";
import type { ReactNode } from "react";

import { useDaemonStatus, useHealth, useRepositories } from "../lib/queries";

const DAEMON_STATUS_LABELS: Record<ConnectionState, string> = {
  online: "Connected",
  offline: "Not connected",
  reconnecting: "Connecting…",
};

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1">
      <h1 className="text-md font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-text-tertiary">{description}</p>
    </div>
  );
}

export function RepositoriesSection() {
  const repositories = useRepositories();
  return (
    <div>
      <SectionHeading
        title="Repositories"
        description="Register local git repositories so runs can create isolated worktrees."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <RepositoriesBody query={repositories} />
      </div>
    </div>
  );
}

function RepositoriesBody({ query }: { query: ReturnType<typeof useRepositories> }) {
  if (query.isPending) return <Skeleton className="m-4" height={40} />;

  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title="Couldn’t load repositories"
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        icon={FolderGit2}
        variant="inline"
        title="No repositories registered"
        description="Register a local repository to validate its git state and run agents against it."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border-subtle">
      {query.data.map((repository) => (
        <RepositoryRow key={repository.id} repository={repository} />
      ))}
    </ul>
  );
}

function RepositoryRow({ repository }: { repository: RepositoryContract }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{repository.name}</span>
      <span className="font-mono text-xs text-text-tertiary">{repository.default_branch}</span>
    </li>
  );
}

export function RuntimesSection() {
  return (
    <div>
      <SectionHeading
        title="Runtimes"
        description="Adapter catalog with honest capability snapshots (chat, resume, fork, permissions, tool calls, abort)."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={Terminal}
          variant="inline"
          title="No runtimes registered"
          description="Runtime adapters are reported by the daemon. Capabilities are shown as present or absent — never aspirational."
        />
      </div>
    </div>
  );
}

export function AgentsSection() {
  return (
    <div>
      <SectionHeading
        title="Agents"
        description="Agent catalog: name, purpose, default runtime preference, allowed capabilities."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={Bot}
          variant="inline"
          title="No agents configured"
          description="Agents are defined alongside the daemon. None are configured yet."
        />
      </div>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-text-tertiary">{value}</dd>
    </div>
  );
}

export function AboutSection() {
  const health = useHealth();
  const { connectionState } = useDaemonStatus();
  return (
    <div>
      <SectionHeading title="About" description="Version, daemon status and diagnostics." />
      <dl className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 text-sm">
        <AboutRow
          label="Otomat"
          value={<span className="font-mono">{health.data?.name ?? "otomat"}</span>}
        />
        <AboutRow
          label="Version"
          value={<span className="font-mono">{health.data?.version ?? "—"}</span>}
        />
        <AboutRow label="Daemon" value={DAEMON_STATUS_LABELS[connectionState]} />
        {health.isSuccess ? (
          <AboutRow
            label="Database"
            value={<span className="font-mono text-xs">{health.data.db_path}</span>}
          />
        ) : null}
      </dl>
    </div>
  );
}
