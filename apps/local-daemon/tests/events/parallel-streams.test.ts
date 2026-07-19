import { join } from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { readRunEvents } from "#events/projection";
import { EventTailer } from "#events/tailer";
import { JsonlEventSink } from "#runtime";

import { setupLedgerDb, type LedgerTestDb } from "../support/ledger-db.js";
import { makeEvent } from "../support/run-event-fixtures.js";

let t: LedgerTestDb;

beforeEach(() => {
  t = setupLedgerDb();
});

afterEach(() => t.cleanup());

function writeEvents(path: string, sessionId: string, from: number, count: number): void {
  const sink = new JsonlEventSink(path);
  for (let index = from; index < from + count; index += 1) {
    sink.emit(
      makeEvent(t.runId, index, {
        id: `${sessionId}:${index}`,
        agent_session_id: t.agentSessionId,
        payload: {
          fidelity: "raw_log",
          adapter: "fake",
          test_adapter: true,
          text: `${sessionId}:${index}:${"x".repeat(16_384)}`,
        },
      }),
    );
  }
  sink.close();
}

it("ingests two session files into one contiguous run ledger", () => {
  const firstPath = join(t.dir, "sessions", "a", "events.jsonl");
  const secondPath = join(t.dir, "sessions", "b", "events.jsonl");
  writeEvents(firstPath, "a", 0, 10);
  writeEvents(secondPath, "b", 10, 10);

  const first = new EventTailer({
    db: t.client.db,
    runId: t.runId,
    streamId: "session:a",
    filePath: firstPath,
  });
  const second = new EventTailer({
    db: t.client.db,
    runId: t.runId,
    streamId: "session:b",
    filePath: secondPath,
  });
  first.drain();
  second.drain();

  const events = readRunEvents(t.client.db, t.runId);
  expect(events).toHaveLength(20);
  expect(events.map((event) => event.seq)).toEqual(Array.from({ length: 20 }, (_, index) => index));
  expect(new Set(events.map((event) => event.id)).size).toBe(20);
});

it("resumes each stream from its own durable cursor without duplicate events", () => {
  const firstPath = join(t.dir, "sessions", "a", "events.jsonl");
  const secondPath = join(t.dir, "sessions", "b", "events.jsonl");
  writeEvents(firstPath, "a", 0, 3);
  writeEvents(secondPath, "b", 3, 3);

  new EventTailer({
    db: t.client.db,
    runId: t.runId,
    streamId: "session:a",
    filePath: firstPath,
  }).drain();
  new EventTailer({
    db: t.client.db,
    runId: t.runId,
    streamId: "session:b",
    filePath: secondPath,
  }).drain();

  expect(
    new EventTailer({
      db: t.client.db,
      runId: t.runId,
      streamId: "session:a",
      filePath: firstPath,
    }).drain().ingested,
  ).toBe(0);
  expect(
    new EventTailer({
      db: t.client.db,
      runId: t.runId,
      streamId: "session:b",
      filePath: secondPath,
    }).drain().ingested,
  ).toBe(0);
  expect(readRunEvents(t.client.db, t.runId)).toHaveLength(6);
});
