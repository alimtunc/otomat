import type { EventEnvelope } from "@otomat/domain";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { expect, it } from "vitest";

import { envelope as makeEnvelope } from "#support/envelope";

const envelope = (seq: number, payload: Record<string, unknown> = {}): EventEnvelope =>
  makeEnvelope({ id: `e${seq}`, seq, payload });

it("summarizes an event by the most specific payload field", () => {
  expect(eventSummary(envelope(0, { text: "hello" }))).toBe("hello");
  expect(eventSummary(envelope(1, { tool: "grep" }))).toBe("tool · grep");
  expect(eventSummary(envelope(2, { provider_session_id: "s1" }))).toBe("session · s1");
  expect(eventSummary(envelope(3, {}))).toBe("runtime.log");
});
