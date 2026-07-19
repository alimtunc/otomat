import type { EventEnvelope } from "@otomat/domain";
import { UsageDetail } from "@web/components/runs/timeline/event-detail/usage-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { parseReportedUsage } from "@web/lib/run-usage";

export function CandidateProviderUsage({ events }: { events: readonly EventEnvelope[] }) {
  const usage = events.filter((event) => event.type === "runtime.usage").at(-1);
  const reportedUsage = usage ? parseReportedUsage(usage.payload) : null;
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        Provider usage
      </p>
      {usage ? (
        <div className="flex flex-col items-start gap-1">
          <UsageDetail event={usage} />
          {reportedUsage?.costUsd === null ? (
            <p className="text-xs text-text-tertiary">No cost reported.</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">Usage and cost were not reported.</p>
      )}
    </section>
  );
}

export function CandidateRuntimeActivity({ events }: { events: readonly EventEnvelope[] }) {
  const activity = events.toReversed();
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        Runtime evidence
      </p>
      {activity.length === 0 ? (
        <p className="text-xs text-text-tertiary">No runtime evidence received.</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-text-secondary">
          {activity.map((event) => (
            <li key={event.id} className="break-words font-mono text-[10px]">
              {eventSummary(event)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
