import type { Db } from "@otomat/db";

import { appendSeqedEvents } from "#events/ledger";
import type { RuntimeEvent } from "#runtime";

import { makeEvent } from "./run-event-fixtures.js";

export interface AppendResult {
  /** Rows actually inserted this batch; conflicts on re-ingest are ignored, not counted. */
  inserted: number;
  /** Next unused per-run `seq` after this batch. */
  nextSeq: number;
}

/** Seeds a batch with contiguous `seq` allocated from `fromSeq`, via the real ledger append. */
export function appendEvents(
  db: Db,
  runId: string,
  events: readonly RuntimeEvent[],
  fromSeq: number,
): AppendResult {
  const entries = events.map((event, index) => ({ event, seq: fromSeq + index }));
  return { inserted: appendSeqedEvents(db, runId, entries), nextSeq: fromSeq + events.length };
}

export function seedContiguousEvents(db: Db, runId: string, count: number, fromSeq = 0): void {
  const events = Array.from({ length: count }, (_, i) => makeEvent(runId, fromSeq + i));
  appendEvents(db, runId, events, fromSeq);
}
