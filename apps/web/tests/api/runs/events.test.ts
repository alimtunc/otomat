import type { EventEnvelope } from "@otomat/domain";
import { mergeEvent, mergeEventWindow } from "@web/api/runs/events";
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

it("continues the loaded pages with the live tail", () => {
  const merged = mergeEventWindow([envelope(3), envelope(4)], [envelope(5), envelope(6)]);
  expect(merged.map((e) => e.seq)).toEqual([3, 4, 5, 6]);
});

it("drops a live event a loaded page already carries", () => {
  const merged = mergeEventWindow([envelope(3), envelope(4)], [envelope(4), envelope(5)]);
  expect(merged.map((e) => e.seq)).toEqual([3, 4, 5]);
});

it("shows the live tail alone while no page is loaded", () => {
  expect(mergeEventWindow([], [envelope(0)]).map((e) => e.seq)).toEqual([0]);
});
