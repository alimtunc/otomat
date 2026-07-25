import type { EventEnvelope } from "@otomat/domain";
import { Spinner } from "@otomat/ui";
import { eventSummary } from "@web/components/runs/timeline/event-summary";

/** The hint is the last persisted ledger event, so the row never implies progress the stream has not proven. */
export function WorkingRow({ latest }: { latest: EventEnvelope | null }) {
  return (
    <div role="listitem" className="flex items-center gap-2.5 px-6 py-3" aria-live="polite">
      <Spinner size={13} label="Agent working" />
      <span className="text-sm text-text-secondary">Agent is working…</span>
      {latest === null ? null : (
        <span className="min-w-0 flex-1 truncate text-xs text-text-tertiary">
          {eventSummary(latest)}
        </span>
      )}
    </div>
  );
}
