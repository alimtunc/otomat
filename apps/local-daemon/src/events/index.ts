/**
 * Append-only runtime-event ledger with a non-lossy file tailer and read-side
 * projections. Per run, `seq` is monotonic across every stream the run owns, so
 * concurrent sessions interleave into one ordered ledger; re-appending an
 * already-committed event is idempotent (event id + `ON CONFLICT DO NOTHING`,
 * with each stream's durable byte cursor advanced in the same transaction), so a
 * tail resuming after a crash replays with neither loss nor duplication. Write
 * via `emitLedgerEvent` or a live `EventTailer`; read the persisted ledger via
 * `readRunEvents`.
 *
 * @packageDocumentation
 */
export {
  appendEventStreamBatch,
  appendSeqedEvents,
  applyLedgerPragmas,
  type EventStreamAppendResult,
  type EventStreamBatch,
  type SeqedEvent,
} from "./ledger.js";
export * from "./tailer.js";
export * from "./projection.js";
export * from "./run-ledger.js";
