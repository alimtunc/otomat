import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEvents } from "#events/projection";

import { setupLedgerDb, type LedgerTestDb } from "../support/ledger-db.js";
import { appendEvents } from "../support/ledger.js";
import { makeEvent } from "../support/run-event-fixtures.js";

let t: LedgerTestDb;

beforeEach(() => {
  t = setupLedgerDb();
});

afterEach(() => {
  t.cleanup();
});

describe("ledger", () => {
  it("allocates contiguous per-run seq from fromSeq", () => {
    const events = [0, 1, 2].map((i) => makeEvent(t.runId, i));
    const result = appendEvents(t.client.db, t.runId, events, 0);

    expect(result).toEqual({ inserted: 3, nextSeq: 3 });
    expect(readRunEvents(t.client.db, t.runId).map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it("is idempotent: re-appending the same (run_id, seq) inserts nothing", () => {
    const events = [0, 1].map((i) => makeEvent(t.runId, i));
    appendEvents(t.client.db, t.runId, events, 0);
    const second = appendEvents(t.client.db, t.runId, events, 0);

    expect(second.inserted).toBe(0);
    expect(readRunEvents(t.client.db, t.runId)).toHaveLength(2);
  });

  it("persists payload and raw_ref pointer faithfully", () => {
    const event = makeEvent(t.runId, 0, {
      raw_ref: "blobs/run-1/0.json",
      payload: { fidelity: "native", adapter: "fake", test_adapter: true, frame: { k: "v" } },
    });
    appendEvents(t.client.db, t.runId, [event], 0);

    const [persisted] = readRunEvents(t.client.db, t.runId);
    expect(persisted.raw_ref).toBe("blobs/run-1/0.json");
    expect(persisted.payload).toEqual(event.payload);
  });
});
