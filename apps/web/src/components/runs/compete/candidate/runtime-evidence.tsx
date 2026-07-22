import type { EventEnvelope } from "@otomat/domain";
import { EvidenceSection } from "@web/components/runs/compete/evidence-section";
import { UsageDetail } from "@web/components/runs/timeline/event-detail/usage-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { latestUsageEvent, parseReportedUsage } from "@web/lib/run-usage";

export function CandidateProviderUsage({ events }: { events: readonly EventEnvelope[] }) {
  const usage = latestUsageEvent(events);
  if (!usage) {
    return <EvidenceSection label="Provider usage" empty="Usage and cost were not reported." />;
  }
  const reportedUsage = parseReportedUsage(usage.payload);
  return (
    <EvidenceSection label="Provider usage">
      <div className="flex flex-col items-start gap-1">
        <UsageDetail event={usage} />
        {reportedUsage === null ? (
          <p className="text-xs text-text-tertiary">Usage payload could not be read.</p>
        ) : null}
        {reportedUsage?.costUsd === null ? (
          <p className="text-xs text-text-tertiary">No cost reported.</p>
        ) : null}
      </div>
    </EvidenceSection>
  );
}

export function CandidateRuntimeActivity({ events }: { events: readonly EventEnvelope[] }) {
  const recentActivity = events.toReversed();
  if (recentActivity.length === 0) {
    return <EvidenceSection label="Runtime evidence" empty="No runtime evidence received." />;
  }
  return (
    <EvidenceSection label="Runtime evidence">
      <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-text-secondary">
        {recentActivity.map((event) => (
          <li key={event.id} className="break-words font-mono text-[10px]">
            {eventSummary(event)}
          </li>
        ))}
      </ul>
    </EvidenceSection>
  );
}
