import { Chip, ErrorState, Icon, RelativeTime, Skeleton } from "@otomat/ui";
import { HealthCheckRow } from "@web/components/settings/project/health/check-row";
import { HostAbsenceState } from "@web/components/settings/project/health/host-absence-state";
import type { ProjectHealthEntry } from "@web/components/settings/project/health/use-project-health";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { PROJECT_HEALTH_TONES } from "@web/lib/project-health-tone";
import { useId } from "react";

export function HostHealthCard({ entry }: { entry: ProjectHealthEntry }) {
  const headingId = useId();
  const report = entry.query.data;
  const summary = report === undefined ? null : PROJECT_HEALTH_TONES[report.status];

  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border-subtle bg-card">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <Icon
          name={entry.host.kind === "ssh" ? "terminal" : "monitor"}
          aria-hidden
          className="h-4 w-4 text-text-tertiary"
        />
        <h3 id={headingId} className="text-sm font-medium text-foreground">
          {entry.host.label}
        </h3>
        {summary === null ? null : <Chip tone={summary.tone}>{summary.label}</Chip>}
        {report === undefined ? null : (
          <span className="ml-auto text-xs text-text-tertiary">
            Checked <RelativeTime date={report.checked_at} />
          </span>
        )}
      </div>
      {entry.absence === null ? (
        <QueryBoundary
          query={entry.query}
          pending={<Skeleton height={160} />}
          error={
            <ErrorState
              variant="inline"
              title="Couldn’t run the health check on this host"
              onRetry={() => void entry.query.refetch()}
            />
          }
        >
          {(data) => (
            <ul className="divide-y divide-border-subtle">
              {data.checks.map((check) => (
                <HealthCheckRow key={check.id} check={check} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      ) : (
        <HostAbsenceState absence={entry.absence} />
      )}
    </section>
  );
}
