import type { EventEnvelope } from "@otomat/domain";
import { TimelineEventRow } from "@otomat/ui";
import { EventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";

export function LedgerEventRow({ event }: { event: EventEnvelope }) {
  return (
    <TimelineEventRow
      id={`event-${event.seq}`}
      type={event.type}
      provenance={event.source}
      summary={eventSummary(event)}
      at={event.occurred_at}
    >
      <EventDetail event={event} />
    </TimelineEventRow>
  );
}
