import type { EventEnvelope } from "@otomat/domain";
import {
  Button,
  cn,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Icon,
  TimelineEventRow,
} from "@otomat/ui";
import { eventDetail } from "@web/components/runs/timeline/event-detail/event-detail";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { describeActivity, type ActivityCounts } from "@web/lib/conversation";
import { FOCUS_RING } from "@web/lib/focus";

/**
 * The work between two things worth reading: tool calls, logs, reasoning and
 * permission round-trips. Collapsed by default and never dropped — the summary
 * states exactly how much is folded, and opening it shows the raw ledger rows.
 */
export function ActivityGroup({
  events,
  counts,
}: {
  events: EventEnvelope[];
  counts: ActivityCounts;
}) {
  return (
    <Collapsible className="group/activity px-6 py-1.5">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={cn(
              "h-auto w-full justify-start gap-2 rounded-md px-2 py-1 font-normal text-text-tertiary hover:text-text-secondary",
              FOCUS_RING,
            )}
          />
        }
      >
        <Icon
          name="chevron-right"
          aria-hidden
          className="transition-transform group-data-[panel-open]/activity:rotate-90"
        />
        <span className="text-xs">{describeActivity(counts, events.length)}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div
          role="list"
          aria-label="Agent activity"
          className="mt-1 rounded-md border border-border-subtle py-1"
        >
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
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
