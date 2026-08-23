import type { EventEnvelope } from "@otomat/domain";
import {
  Button,
  cn,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  FOCUS_RING,
  Icon,
} from "@otomat/ui";
import { LedgerEventRow } from "@web/components/runs/conversation/ledger-event-row";
import { describeActivity, type ActivityCounts } from "@web/lib/conversation";

export function ActivityGroup({
  events,
  counts,
}: {
  events: EventEnvelope[];
  counts: ActivityCounts;
}) {
  return (
    <Collapsible render={<li />} className="group/activity px-6 py-1.5">
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
        <ul
          aria-label="Agent activity"
          className="mt-1 rounded-md border border-border-subtle py-1"
        >
          {events.map((event) => (
            <li key={event.seq}>
              <LedgerEventRow event={event} />
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
