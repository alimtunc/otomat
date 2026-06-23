/**
 * SQLite `busy_timeout` the ledger applies so a reader/writer waits out a peer's
 * lock under WAL instead of failing fast with `SQLITE_BUSY`.
 */
export const DEFAULT_BUSY_TIMEOUT_MS = 5000;

/** Conventional per-run evidence file the runtime appends to (OTO-6 `JsonlEventSink`). */
export const EVENTS_FILENAME = "events.jsonl";

/** Max rows per `INSERT` so a coalesced tick stays well under SQLite's bound-parameter ceiling. */
export const INSERT_CHUNK = 500;

export interface AppendResult {
  /** Rows actually inserted this batch; conflicts on re-ingest are ignored, not counted. */
  inserted: number;
  /** Next unused per-run `seq` after this batch. */
  nextSeq: number;
}

export interface TailTickResult {
  /** New rows persisted this tick. */
  ingested: number;
  /** Bytes of `events.jsonl` consumed so far. */
  byteOffset: number;
  /** Next unused per-run `seq`. */
  nextSeq: number;
}
