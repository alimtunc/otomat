import type { ProjectContract } from "@otomat/domain";
import { Button, ErrorState } from "@otomat/ui";
import { HostHealthCard } from "@web/components/settings/project/health/host-card";
import { useProjectHealth } from "@web/components/settings/project/health/use-project-health";

export function ProjectHealthPanel({ project }: { project: ProjectContract }) {
  const health = useProjectHealth(project);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">Health check</h2>
        <Button
          className="ml-auto"
          variant="outline"
          size="xs"
          loading={health.refreshing}
          onClick={health.refresh}
        >
          Run health check
        </Button>
      </div>
      <p className="text-xs text-text-tertiary">
        Whether this project can launch and drive agents on each host, as that host itself reports
        it. Nothing is installed, connected or repaired to find out.
      </p>
      {health.hostsUnknown ? (
        <ErrorState
          variant="compact"
          title="Couldn’t list this machine’s hosts"
          description="Only the active host is reported below."
          onRetry={health.refresh}
        />
      ) : null}
      <div className="flex flex-col gap-3">
        {health.entries.map((entry) => (
          <HostHealthCard key={entry.host.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
