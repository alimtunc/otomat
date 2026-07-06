import type { EventEnvelope } from "@otomat/domain";
import { EmptyState, TimelineEventRow } from "@otomat/ui";
import type { RunStreamState } from "@web/api/runs/run-events-provider";
import { emptyTimelineContent } from "@web/components/runs/timeline/copy";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { CenteredState } from "@web/components/shell/centered-state";

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
      <CenteredState fill="flex">
        <EmptyState
          icon="loader"
          tone={empty.tone}
          title={empty.title}
          description={empty.description}
        />
      </CenteredState>
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
