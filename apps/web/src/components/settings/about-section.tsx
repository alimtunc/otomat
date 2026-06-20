import { type ConnectionState } from "@otomat/ui";
import { useDaemonStatus, useHealth } from "@web/api/daemon/queries";
import { AboutRow } from "@web/components/settings/about-row";
import { SectionHeading } from "@web/components/settings/section-heading";

const DAEMON_STATUS_LABELS: Record<ConnectionState, string> = {
  online: "Connected",
  offline: "Not connected",
  reconnecting: "Connecting…",
};

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
