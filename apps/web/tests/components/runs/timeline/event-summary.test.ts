import type { EventEnvelope } from "@otomat/domain";
import { eventSummary } from "@web/components/runs/timeline/event-summary";
import { expect, it } from "vitest";

import { envelope as makeEnvelope } from "#support/envelope";

const envelope = (seq: number, payload: Record<string, unknown> = {}): EventEnvelope =>
  makeEnvelope({ id: `e${seq}`, seq, payload });

const typed = (type: EventEnvelope["type"], payload: Record<string, unknown> = {}) =>
  eventSummary(makeEnvelope({ id: "t", seq: 9, type, payload }));

it("summarizes an event by the most specific payload field", () => {
  expect(eventSummary(envelope(0, { text: "hello" }))).toBe("hello");
  expect(eventSummary(envelope(1, { tool: "grep" }))).toBe("tool · grep");
  expect(eventSummary(envelope(2, { provider_session_id: "s1" }))).toBe("session · s1");
  expect(eventSummary(envelope(3, {}))).toBe("runtime.log");
});

it("summarizes control-plane events by type", () => {
  expect(typed("run.lifecycle", { final_status: "completed" })).toBe("run completed");
  expect(typed("run.lifecycle")).toBe("run.lifecycle");
  expect(typed("git.diff_updated", { additions: 1 })).toBe("canonical git diff updated");
  expect(typed("runtime.usage", { usage: {} })).toBe("usage reported by the runtime");
  expect(typed("review.comment_created", { file_path: "a.ts", line: 3 })).toBe("comment · a.ts:3");
  expect(typed("pr.created", { url: "u" })).toBe("pull request created");
  expect(typed("pr.updated")).toBe("pull request updated");
});
