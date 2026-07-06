import type { EventEnvelope } from "@otomat/domain";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { expect, it } from "vitest";

function envelope(seq: number, payload: Record<string, unknown> = {}): EventEnvelope {
  return {
    id: `e${seq}`,
    run_id: "run-1",
    step_run_id: null,
    agent_session_id: null,
    seq,
    type: "runtime.log",
    source: "otomat",
    occurred_at: "2026-01-01T00:00:00.000Z",
    payload,
    raw_ref: null,
  };
}

it("summarizes an event by the most specific payload field", () => {
  expect(eventSummary(envelope(0, { text: "hello" }))).toBe("hello");
  expect(eventSummary(envelope(1, { tool: "grep" }))).toBe("tool · grep");
  expect(eventSummary(envelope(2, { provider_session_id: "s1" }))).toBe("session · s1");
  expect(eventSummary(envelope(3, {}))).toBe("runtime.log");
});
