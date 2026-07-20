import type { EventEnvelope } from "@otomat/domain";
import { TimelineEventRow } from "@otomat/ui";
import { isErrorLogEvent } from "@web/components/runs/logs/log-filters";
import { eventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { JsonDisclosure } from "@web/components/runs/timeline/event-detail/json-disclosure";
import { eventSummary } from "@web/components/runs/timeline/event-summary";

export function LogRow({ event }: { event: EventEnvelope }) {
  return (
    <TimelineEventRow
      type={event.type}
      provenance={event.source}
      summary={eventSummary(event)}
      at={event.occurred_at}
    >
      <div className="flex flex-col">
        <span className="font-mono text-[10px] text-text-tertiary">
          seq {event.seq}
          {isErrorLogEvent(event) ? " · error" : ""}
          {event.raw_ref !== null ? ` · raw ${event.raw_ref}` : ""}
        </span>
        {eventDetail(event)}
        <JsonDisclosure label="payload" value={event.payload} />
      </div>
    </TimelineEventRow>
  );
}
