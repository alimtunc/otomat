import type { Db } from "@otomat/db";

import { appendSeqedEvents } from "#events/ledger";
import type { RuntimeEvent } from "#runtime";

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
