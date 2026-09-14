import type { EventEnvelope } from "@otomat/domain";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  EventTime,
  FOCUS_RING_INSET,
  Icon,
} from "@otomat/ui";
import { useRouterState } from "@tanstack/react-router";
import { isErrorLogEvent } from "@web/components/runs/logs/log-filters";
import { EventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { JsonDisclosure } from "@web/components/runs/timeline/event-detail/json-disclosure";
import { eventSummary } from "@web/components/runs/timeline/event-summary";

export function LogRow({ event }: { event: EventEnvelope }) {
  const hash = useRouterState({ select: (state) => state.location.hash });
  const summary = eventSummary(event);
  const error = isErrorLogEvent(event);
  return (
    <Collapsible id={`event-${event.seq}`} defaultOpen={hash === `event-${event.seq}`}>
      <CollapsibleTrigger
        className={`flex w-full min-w-0 items-center gap-2 px-3.5 py-1.5 text-left text-xs hover:bg-hover ${FOCUS_RING_INSET}`}
      >
        <EventTime at={event.occurred_at} className="shrink-0 pt-0 text-xs" />
        <Icon
          name={error ? "alert-triangle" : "chevron-right"}
          size="xs"
          aria-hidden
          className={error ? "text-danger" : "text-text-tertiary"}
        />
        <span className={error ? "shrink-0 text-danger" : "shrink-0 text-text-secondary"}>
          {event.type}
        </span>
        <span className="min-w-0 flex-1 truncate text-text-secondary">
          {summary === event.type ? null : summary}
        </span>
        <span className="shrink-0 text-text-tertiary">{event.source}</span>
        <span className="shrink-0 font-mono text-text-tertiary">#{event.seq}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="px-6 pb-3">
        <p className={error ? "text-xs text-danger" : "text-xs text-text-secondary"}>{summary}</p>
        <span className="font-mono text-micro text-text-tertiary">
          {event.raw_ref !== null ? `raw ${event.raw_ref}` : ""}
        </span>
        <EventDetail event={event} />
        <JsonDisclosure label="payload" value={event.payload} />
      </CollapsiblePanel>
    </Collapsible>
  );
}
