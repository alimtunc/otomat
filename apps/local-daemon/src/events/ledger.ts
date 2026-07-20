import { schema, type Db } from "@otomat/db";
import { and, eq, max, sql } from "drizzle-orm";

import type { RuntimeEvent } from "#runtime";

const { eventStreams, runtimeEvents } = schema;

/**
 * SQLite `busy_timeout` the ledger applies so a reader/writer waits out a peer's
 * lock under WAL instead of failing fast with `SQLITE_BUSY`.
 */
const DEFAULT_BUSY_TIMEOUT_MS = 5000;

/** Max rows per `INSERT` so a coalesced tick stays well under SQLite's bound-parameter ceiling. */
const INSERT_CHUNK = 500;

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

interface EventStreamBatch {
  streamId: string;
  filePath: string;
  fromByteOffset: number;
  consumedBytes: number;
  events: readonly RuntimeEvent[];
}

/** Appends one stream slice and advances its byte cursor in the same immediate transaction. */
export function appendEventStreamBatch(db: Db, runId: string, batch: EventStreamBatch): number {
  return db.transaction(
    (tx) => {
      const stream = tx
        .select()
        .from(eventStreams)
        .where(and(eq(eventStreams.id, batch.streamId), eq(eventStreams.run_id, runId)))
        .get();
      if (!stream || stream.file_path !== batch.filePath) {
        throw new Error(`event stream ${batch.streamId} is not attached to run ${runId}`);
      }
      if (stream.byte_offset !== batch.fromByteOffset) {
        throw new Error(
          `event stream ${batch.streamId} cursor changed from ${batch.fromByteOffset} to ${stream.byte_offset}`,
        );
      }

      const maxRow = tx
        .select({ maxSeq: max(runtimeEvents.seq) })
        .from(runtimeEvents)
        .where(eq(runtimeEvents.run_id, runId))
        .get();
      let nextSeq = (maxRow?.maxSeq ?? -1) + 1;
      let inserted = 0;

      for (const event of batch.events) {
        if (event.run_id !== runId) {
          throw new Error(`event ${event.id} belongs to run ${event.run_id}, expected ${runId}`);
        }
        const insertion = tx
          .insert(runtimeEvents)
          .values({
            id: event.id,
            run_id: runId,
            step_run_id: event.step_run_id,
            agent_session_id: event.agent_session_id,
            seq: nextSeq,
            type: event.type,
            source: event.source,
            occurred_at: event.occurred_at,
            payload: event.payload,
            raw_ref: event.raw_ref,
          })
          .onConflictDoNothing({ target: runtimeEvents.id })
          .run();
        if (insertion.changes === 0) continue;
        inserted += 1;
        nextSeq += 1;
      }

      tx.update(eventStreams)
        .set({
          byte_offset: batch.fromByteOffset + batch.consumedBytes,
          updated_at: sql`(CURRENT_TIMESTAMP)`,
        })
        .where(eq(eventStreams.id, batch.streamId))
        .run();

      return inserted;
    },
    { behavior: "immediate" },
  );
}
