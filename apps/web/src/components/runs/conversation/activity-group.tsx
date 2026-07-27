import type { EventEnvelope } from "@otomat/domain";
import { Button, cn, Collapsible, CollapsiblePanel, CollapsibleTrigger, Icon } from "@otomat/ui";
import { LedgerEventRow } from "@web/components/runs/conversation/ledger-event-row";
import { describeActivity, type ActivityCounts } from "@web/lib/conversation";
import { FOCUS_RING } from "@web/lib/focus";

/** Collapsed by default and never dropped: the summary states exactly how much work is folded away. */
export function ActivityGroup({
  events,
  counts,
}: {
  events: EventEnvelope[];
  counts: ActivityCounts;
}) {
  return (
    <Collapsible role="listitem" className="group/activity px-6 py-1.5">
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
        <span className="text-xs">{describeActivity(counts)}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div
          role="list"
          aria-label="Agent activity"
          className="mt-1 rounded-md border border-border-subtle py-1"
        >
          {events.map((event) => (
            <LedgerEventRow key={event.seq} event={event} />
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
