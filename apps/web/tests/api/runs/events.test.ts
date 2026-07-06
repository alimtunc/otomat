import type { EventEnvelope } from "@otomat/domain";
import { mergeEvent } from "@web/api/runs/events";
import { expect, it } from "vitest";

import { envelope as makeEnvelope } from "#support/envelope";

const envelope = (seq: number, payload: Record<string, unknown> = {}): EventEnvelope =>
  makeEnvelope({ id: `e${seq}`, seq, payload });

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
