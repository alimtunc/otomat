import type { EventEnvelope } from "@otomat/domain";
import { EmptyState, TimelineEventRow } from "@otomat/ui";
import { eventSummary } from "@web/api/runs/events";
import type { RunStreamState } from "@web/api/runs/queries";
import { Loader } from "lucide-react";

import { emptyTimelineContent } from "./run-timeline-copy";

export function RunTimeline({
  events,
  state,
  degraded,
}: {
  events: EventEnvelope[];
  state: RunStreamState;
  degraded: boolean;
}) {
  const isError = state === "error";

  if (events.length === 0) {
    const empty = emptyTimelineContent(isError, degraded);
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          icon={Loader}
          tone={empty.tone}
          title={empty.title}
          description={empty.description}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {degraded ? (
        <div
          aria-live="polite"
          className="border-b border-border-subtle px-6 py-2 text-xs text-danger"
        >
          Some events could not be decoded — this timeline may be incomplete.
        </div>
      ) : null}
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
    </div>
  );
}
