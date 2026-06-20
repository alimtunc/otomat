import { EmptyState } from "@otomat/ui";
import { Bot, FolderGit2, Info, Terminal } from "lucide-react";

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 flex flex-col gap-1">
      <h1 className="text-md font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-text-tertiary">{description}</p>
    </div>
  );
}

export function RepositoriesSection() {
  return (
    <div>
      <SectionHeading
        title="Repositories"
        description="Register local git repositories so runs can create isolated worktrees."
      />
      <div className="rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={FolderGit2}
          variant="inline"
          title="No repositories registered"
          description="Register a local repository to validate its git state and run agents against it. Daemon connectivity arrives in OTO-9."
        />
      </div>
    </div>
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
          title="No runtimes available"
          description="Runtime adapters are reported by a connected daemon. Capabilities are shown as present or absent — never aspirational."
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
          description="Agents are defined alongside a connected daemon. This list populates in OTO-9."
        />
      </div>
    </div>
  );
}

export function AboutSection() {
  return (
    <div>
      <SectionHeading title="About" description="Version, daemon status and diagnostics." />
      <dl className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-secondary">Otomat</dt>
          <dd className="font-mono text-text-tertiary">v0.0.0 — design prepass</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-text-secondary">Daemon</dt>
          <dd className="text-text-tertiary">Not connected (OTO-9)</dd>
        </div>
      </dl>
      <div className="mt-4 rounded-lg border border-border-subtle bg-card">
        <EmptyState
          icon={Info}
          variant="inline"
          title="Diagnostics unavailable"
          description="Daemon health and reconciliation diagnostics surface once a daemon is connected."
        />
      </div>
    </div>
  );
}
