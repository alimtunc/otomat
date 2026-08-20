import type { EventEnvelope } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import type { RunStreamState } from "@web/api/runs/run-event-stream";
import type { RunEventHistory } from "@web/api/runs/use-event-history";
import { matchesLogFilter, type LogFilter } from "@web/components/runs/logs/log-filters";
import { LogRow } from "@web/components/runs/logs/log-row";
import { emptyTimelineContent } from "@web/components/runs/timeline/copy";
import { EarlierActivity } from "@web/components/runs/timeline/earlier-activity";
import { CenteredState } from "@web/components/shell/centered-state";

export interface LogListProps {
  events: readonly EventEnvelope[];
  filter: LogFilter;
  state: RunStreamState;
  degraded: boolean;
  history: RunEventHistory;
}

function LogBody({ events, filter, state, degraded, history }: LogListProps) {
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

  return (
    <ul aria-label="Run logs" className="min-h-0 flex-1 overflow-auto py-2">
      <EarlierActivity history={history} />
      {filtered.length === 0 ? (
        <li className="px-6 py-8">
          <EmptyState
            icon="terminal"
            variant="inline"
            title="No matching events"
            description="No loaded event matches this filter."
          />
        </li>
      ) : (
        filtered.map((event) => (
          <li key={event.seq}>
            <LogRow event={event} />
          </li>
        ))
      )}
    </ul>
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
