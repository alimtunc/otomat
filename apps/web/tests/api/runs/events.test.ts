import type { EventEnvelope } from "@otomat/domain";
import { mergeEvent } from "@web/api/runs/events";
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

it("appends ascending events in order", () => {
  let events: EventEnvelope[] = [];
  for (const seq of [0, 1, 2]) events = mergeEvent(events, envelope(seq));
  expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
});

it("dedups a replayed seq without reordering", () => {
  let events: EventEnvelope[] = [];
  for (const seq of [0, 1, 2]) events = mergeEvent(events, envelope(seq));
  const before = events;
  events = mergeEvent(events, envelope(1));
  expect(events).toBe(before);
  expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
});

it("sorts an out-of-order late arrival back into place", () => {
  let events: EventEnvelope[] = [];
  for (const seq of [0, 2]) events = mergeEvent(events, envelope(seq));
  events = mergeEvent(events, envelope(1));
  expect(events.map((e) => e.seq)).toEqual([0, 1, 2]);
});
