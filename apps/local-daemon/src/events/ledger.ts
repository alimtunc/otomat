import { schema, type Db } from "@otomat/db";
import { eq, max, sql } from "drizzle-orm";

import type { RuntimeEvent } from "#runtime";

import { DEFAULT_BUSY_TIMEOUT_MS, INSERT_CHUNK, type AppendResult } from "./types.js";

const { runtimeEvents } = schema;

/** A runtime event paired with the per-run `seq` allocated for it at persistence time. */
export interface SeqedEvent {
  event: RuntimeEvent;
  seq: number;
}

/**
 * Sets `busy_timeout` on the connection. WAL mode and `foreign_keys` are already
 * enabled by `@otomat/db`'s client; this only adds lock patience for the tailer.
 */
export function applyLedgerPragmas(db: Db, busyTimeoutMs = DEFAULT_BUSY_TIMEOUT_MS): void {
  db.run(sql.raw(`PRAGMA busy_timeout = ${busyTimeoutMs}`));
}

/** Highest persisted `seq` for a run, or `null` when it has no events yet. */
export function maxSeqForRun(db: Db, runId: string): number | null {
  const row = db
    .select({ maxSeq: max(runtimeEvents.seq) })
    .from(runtimeEvents)
    .where(eq(runtimeEvents.run_id, runId))
    .get();
  return row?.maxSeq ?? null;
}

/** Next unused per-run `seq`: one past the highest persisted, or 0 for a fresh run. */
export function nextSeqForRun(db: Db, runId: string): number {
  const maxSeq = maxSeqForRun(db, runId);
  return maxSeq === null ? 0 : maxSeq + 1;
}

/**
 * Appends events with explicit per-run `seq` as one `BEGIN IMMEDIATE` transaction.
 * Re-appending already-stored events is a no-op: the unique `(run_id, seq)` index
 * plus `ON CONFLICT DO NOTHING` means a tail that resumes over previously committed
 * lines neither loses nor duplicates them. Returns the number of rows inserted.
 */
export function appendSeqedEvents(db: Db, runId: string, entries: readonly SeqedEvent[]): number {
  if (entries.length === 0) return 0;

  const rows = entries.map(({ event, seq }) => ({
    id: event.id,
    run_id: runId,
    step_run_id: event.step_run_id,
    agent_session_id: event.agent_session_id,
    seq,
    type: event.type,
    source: event.source,
    occurred_at: event.occurred_at,
    payload: event.payload,
    raw_ref: event.raw_ref,
  }));

  let inserted = 0;
  db.transaction(
    (tx) => {
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        const result = tx
          .insert(runtimeEvents)
          .values(rows.slice(i, i + INSERT_CHUNK))
          .onConflictDoNothing()
          .run();
        inserted += result.changes;
      }
    },
    { behavior: "immediate" },
  );

  return inserted;
}

/** Appends a batch with contiguous `seq` allocated from `fromSeq`. */
export function appendEvents(
  db: Db,
  runId: string,
  events: readonly RuntimeEvent[],
  fromSeq: number,
): AppendResult {
  const entries = events.map((event, index) => ({ event, seq: fromSeq + index }));
  return { inserted: appendSeqedEvents(db, runId, entries), nextSeq: fromSeq + events.length };
}
