import type { EventEnvelope } from "@otomat/domain";
import { EmptyState, TimelineEventRow } from "@otomat/ui";
import { eventSummary } from "@web/api/runs/events";
import type { RunStreamState } from "@web/api/runs/queries";
import { Loader } from "lucide-react";

export function RunTimeline({ events, state }: { events: EventEnvelope[]; state: RunStreamState }) {
  const isError = state === "error";

  if (events.length === 0) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          icon={Loader}
          tone={isError ? "error" : "neutral"}
          title={isError ? "Stream interrupted" : "Waiting to start"}
          description={
            isError
              ? "The event stream dropped. It reconnects automatically."
              : "No events yet. The run timeline streams from the daemon over SSE."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto py-2" role="list">
      {events.map((event) => (
        <TimelineEventRow
          key={event.seq}
          type={event.type}
          provenance={event.source}
          summary={eventSummary(event)}
          at={event.occurred_at}
        />
      ))}
    </div>
  );
}
