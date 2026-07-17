import { schema } from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events/projection";

import { setupLedgerDb, type LedgerTestDb } from "../support/ledger-db.js";
import { appendEvents } from "../support/ledger.js";
import { makeEvent } from "../support/run-event-fixtures.js";

let t: LedgerTestDb;

beforeEach(() => {
  t = setupLedgerDb();
  appendEvents(
    t.client.db,
    t.runId,
    [0, 1, 2, 3].map((i) => makeEvent(t.runId, i)),
    0,
  );
});

afterEach(() => {
  t.cleanup();
});

describe("projection", () => {
  it("reads persisted events in seq order", () => {
    expect(readRunEvents(t.client.db, t.runId).map((e) => e.seq)).toEqual([0, 1, 2, 3]);
  });

  it("afterSeq returns only newer events (SSE catch-up cursor)", () => {
    expect(readRunEvents(t.client.db, t.runId, { afterSeq: 1 }).map((e) => e.seq)).toEqual([2, 3]);
  });

  it("respects limit", () => {
    expect(readRunEvents(t.client.db, t.runId, { limit: 2 }).map((e) => e.seq)).toEqual([0, 1]);
  });

  it("returns validated envelopes", () => {
    const [first] = readRunEvents(t.client.db, t.runId);
    expect(first.type).toBe("runtime.log");
    expect(first.source).toBe("otomat");
    expect(first.run_id).toBe(t.runId);
  });

  it("skips a row that fails envelope validation instead of failing the whole read", () => {
    t.client.db
      .insert(schema.runtimeEvents)
      .values({
        id: "bogus",
        run_id: t.runId,
        step_run_id: null,
        agent_session_id: null,
        seq: 4,
        type: "not-a-real-type",
        source: "otomat",
        occurred_at: "2026-01-01T00:00:00.000Z",
        payload: {},
        raw_ref: null,
      })
      .run();

    expect(readRunEvents(t.client.db, t.runId).map((e) => e.seq)).toEqual([0, 1, 2, 3]);
  });
});
