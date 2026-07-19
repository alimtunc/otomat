import { afterEach, beforeEach, expect, it } from "vitest";

import { schema } from "#db/index";
import {
  advanceEventStreamCursor,
  ensureEventStream,
  EventStreamConflictError,
  getEventStream,
} from "#db/repositories/event-streams";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-event-streams-");
  seedProject(t.client.db);
  t.client.db
    .insert(schema.issues)
    .values({ id: "i1", project_id: "p1", title: "Issue", status: "ready" })
    .run();
  t.client.db
    .insert(schema.runs)
    .values({
      id: "r1",
      issue_id: "i1",
      branch: "otomat/run/r1",
      plan_json: { version: 1, steps: [] },
    })
    .run();
});

afterEach(() => t.cleanup());

it("creates one durable stream and reuses the same attachment", () => {
  const created = ensureEventStream(t.client.db, {
    id: "session:s1",
    run_id: "r1",
    file_path: "/tmp/r1/s1/events.jsonl",
  });
  const repeated = ensureEventStream(t.client.db, {
    id: "session:s1",
    run_id: "r1",
    file_path: "/tmp/r1/s1/events.jsonl",
  });

  expect(created.byte_offset).toBe(0);
  expect(repeated).toEqual(created);
});

it("rejects reattaching a stream id to another file or run", () => {
  ensureEventStream(t.client.db, {
    id: "session:s1",
    run_id: "r1",
    file_path: "/tmp/r1/s1/events.jsonl",
  });

  expect(() =>
    ensureEventStream(t.client.db, {
      id: "session:s1",
      run_id: "r1",
      file_path: "/tmp/other/events.jsonl",
    }),
  ).toThrow(EventStreamConflictError);
});

it("advances the cursor monotonically", () => {
  ensureEventStream(t.client.db, {
    id: "session:s1",
    run_id: "r1",
    file_path: "/tmp/r1/s1/events.jsonl",
  });

  advanceEventStreamCursor(t.client.db, "session:s1", 120);
  expect(getEventStream(t.client.db, "session:s1")?.byte_offset).toBe(120);
  expect(() => advanceEventStreamCursor(t.client.db, "session:s1", 119)).toThrow(
    EventStreamConflictError,
  );
});
