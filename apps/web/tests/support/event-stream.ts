import type { RunEventStream } from "@web/api/runs/run-event-stream";
import type { RunEventHistory } from "@web/api/runs/use-event-window-history";

export function eventHistory(overrides: Partial<RunEventHistory> = {}): RunEventHistory {
  return {
    events: [],
    status: "ready",
    tailSeq: null,
    hasOlder: false,
    loadingOlder: false,
    olderFailed: false,
    loadOlder: () => {},
    retry: () => {},
    ...overrides,
  };
}

export function eventStream(overrides: Partial<RunEventStream> = {}): RunEventStream {
  const events = overrides.events ?? [];
  return {
    events,
    state: "open",
    degraded: false,
    history: eventHistory({ events, tailSeq: events.at(-1)?.seq ?? null }),
    ...overrides,
  };
}
