import { schema } from "@otomat/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRunEventWindow } from "#events/projection";

import { setupLedgerDb, type LedgerTestDb } from "../support/ledger-db.js";
import { seedContiguousEvents } from "../support/ledger.js";

let t: LedgerTestDb;

function seed(count: number, fromSeq = 0): void {
  seedContiguousEvents(t.client.db, t.runId, count, fromSeq);
}

function seqs(options: { before?: number; limit?: number } = {}): number[] {
  return readRunEventWindow(t.client.db, t.runId, options).events.map((event) => event.seq);
}

beforeEach(() => {
  t = setupLedgerDb();
});

afterEach(() => {
  t.cleanup();
});

describe("run event window", () => {
  it("anchors the first page on the newest events, in seq order", () => {
    seed(10);
    const page = readRunEventWindow(t.client.db, t.runId, { limit: 4 });

    expect(page.events.map((event) => event.seq)).toEqual([6, 7, 8, 9]);
    expect(page.olderCursor).toBe(6);
  });

  it("walks back page by page without a gap, a duplicate or a reorder", () => {
    seed(10);
    const read: number[] = [];
    let cursor: number | null = null;

    for (let step = 0; step < 3; step += 1) {
      const page = readRunEventWindow(t.client.db, t.runId, {
        limit: 4,
        before: cursor ?? undefined,
      });
      read.unshift(...page.events.map((event) => event.seq));
      cursor = page.olderCursor;
    }

    expect(read).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(cursor).toBeNull();
  });

  it("reports the ledger start instead of an endless cursor", () => {
    seed(3);
    const page = readRunEventWindow(t.client.db, t.runId, { limit: 4 });

    expect(page.events.map((event) => event.seq)).toEqual([0, 1, 2]);
    expect(page.olderCursor).toBeNull();
  });

  it("offers no page above one the ledger start fills exactly", () => {
    seed(4);
    const page = readRunEventWindow(t.client.db, t.runId, { limit: 4 });

    expect(page.events.map((event) => event.seq)).toEqual([0, 1, 2, 3]);
    expect(page.olderCursor).toBeNull();
  });

  it("keeps an older page identical when the run appends while it is being read", () => {
    seed(6);
    const first = readRunEventWindow(t.client.db, t.runId, { limit: 3 });
    seed(4, 6);

    const older = readRunEventWindow(t.client.db, t.runId, {
      limit: 3,
      before: first.olderCursor ?? undefined,
    });

    expect(first.events.map((event) => event.seq)).toEqual([3, 4, 5]);
    expect(older.events.map((event) => event.seq)).toEqual([0, 1, 2]);
  });

  it("serves an empty ledger without offering a page above it", () => {
    expect(readRunEventWindow(t.client.db, t.runId)).toEqual({ events: [], olderCursor: null });
  });

  it("keeps paging past a row that fails envelope validation", () => {
    seed(4);
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

    const page = readRunEventWindow(t.client.db, t.runId, { limit: 2 });

    expect(page.events.map((event) => event.seq)).toEqual([3]);
    expect(page.olderCursor).toBe(3);
    expect(seqs({ before: 3, limit: 2 })).toEqual([1, 2]);
  });

  it("clamps an unbounded limit to what one page may serve", () => {
    seed(600);
    expect(seqs({ limit: 10_000 })).toHaveLength(500);
    expect(seqs({ limit: 0 })).toEqual([599]);
  });
});
