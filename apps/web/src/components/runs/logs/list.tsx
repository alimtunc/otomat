import type { EventEnvelope } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import type { RunStreamState } from "@web/api/runs/run-events-provider";
import { matchesLogFilter, type LogFilter } from "@web/components/runs/logs/log-filters";
import { LogRow } from "@web/components/runs/logs/log-row";
import { emptyTimelineContent } from "@web/components/runs/timeline/copy";
import { CenteredState } from "@web/components/shell/centered-state";

export interface LogListProps {
  events: readonly EventEnvelope[];
  filter: LogFilter;
  state: RunStreamState;
  degraded: boolean;
}

function LogBody({ events, filter, state, degraded }: LogListProps) {
  if (events.length === 0) {
    const empty = emptyTimelineContent(state === "error", degraded);
    return (
      <CenteredState fill="flex">
        <EmptyState
          icon="terminal"
          tone={empty.tone}
          title={empty.title}
          description={empty.description}
        />
      </CenteredState>
    );
  }

  const filtered = events.filter((event) => matchesLogFilter(event, filter));
  if (filtered.length === 0) {
    return (
      <CenteredState fill="flex">
        <EmptyState
          icon="terminal"
          title="No matching events"
          description="No persisted event matches this filter for the run so far."
        />
      </CenteredState>
    );
  }

  return (
    <div role="list" aria-label="Run logs" className="min-h-0 flex-1 overflow-auto py-2">
      {filtered.map((event) => (
        <LogRow key={event.seq} event={event} />
      ))}
    </div>
  );
}

export function LogList(props: LogListProps) {
  return (
    <>
      {props.degraded ? (
        <div
          aria-live="polite"
          className="border-b border-border-subtle px-6 py-2 text-xs text-danger"
        >
          Some events could not be decoded — this log may be incomplete.
        </div>
      ) : null}
      <LogBody {...props} />
    </>
  );
}
