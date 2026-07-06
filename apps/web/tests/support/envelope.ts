import type { EventEnvelope } from "@otomat/domain";

export function envelope(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  return {
    id: "e0",
    run_id: "run-1",
    step_run_id: null,
    agent_session_id: null,
    seq: 0,
    type: "runtime.log",
    source: "otomat",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload: {},
    raw_ref: null,
    ...overrides,
  };
}
