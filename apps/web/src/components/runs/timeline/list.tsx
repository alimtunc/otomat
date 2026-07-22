import type { EventEnvelope } from "@otomat/domain";
import { EmptyState, TimelineEventRow } from "@otomat/ui";
import type { RunStreamState } from "@web/api/runs/run-events-provider";
import { emptyTimelineContent } from "@web/components/runs/timeline/copy";
import { eventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { CenteredState } from "@web/components/shell/centered-state";
import { groupEventsByStep } from "@web/lib/run-plan";

function EventRows({ events }: { events: EventEnvelope[] }) {
  return (
    <>
      {events.map((event) => (
        <TimelineEventRow
          key={event.seq}
          id={`event-${event.seq}`}
          type={event.type}
          provenance={event.source}
          summary={eventSummary(event)}
          at={event.occurred_at}
        >
          {eventDetail(event)}
        </TimelineEventRow>
      ))}
    </>
  );
}

export function RunTimeline({
  events,
  steps,
  state,
  degraded,
}: {
  events: EventEnvelope[];
  steps: { id: string; name: string }[];
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

  const grouped = steps.length > 1 ? groupEventsByStep(events, steps) : null;

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
      <div className="flex-1 overflow-auto py-2" role={grouped === null ? "list" : undefined}>
        {grouped === null ? (
          <EventRows events={events} />
        ) : (
          grouped.map((group) => {
            const label = group.stepName ?? "Run";
            return (
              // The first event's seq is stable and unique per consecutive group.
              <div key={group.events[0].seq}>
                <div className="px-6 pb-1 pt-2.5 text-micro font-semibold uppercase tracking-wide text-text-tertiary">
                  {label}
                </div>
                <div role="list" aria-label={label}>
                  <EventRows events={group.events} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
