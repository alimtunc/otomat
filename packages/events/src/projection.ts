import { schema, type Db } from "@otomat/db";
import { eventEnvelopeSchema, type EventEnvelope } from "@otomat/domain";
import { and, asc, eq, gt } from "drizzle-orm";

import { maxSeqForRun } from "./ledger.js";

const { runtimeEvents } = schema;

export interface ReadRunEventsOptions {
  /** Only events whose `seq` is strictly greater than this (SSE catch-up cursor). */
  afterSeq?: number;
  limit?: number;
}

/**
 * Reads a run's persisted events in `seq` order — the projection OTO-9 serves
 * over SSE. The persisted ledger, never the adapter's in-memory state, is the
 * source of truth for any UI/API surface. A row that fails envelope validation
 * is skipped, so one malformed row can never blank out the whole run's stream.
 */
export function readRunEvents(
  db: Db,
  runId: string,
  options: ReadRunEventsOptions = {},
): EventEnvelope[] {
  const where =
    options.afterSeq === undefined
      ? eq(runtimeEvents.run_id, runId)
      : and(eq(runtimeEvents.run_id, runId), gt(runtimeEvents.seq, options.afterSeq));

  const base = db.select().from(runtimeEvents).where(where).orderBy(asc(runtimeEvents.seq));
  const rows = options.limit === undefined ? base.all() : base.limit(options.limit).all();
  return rows.map(toEnvelope).filter((event): event is EventEnvelope => event !== null);
}

/** Highest persisted `seq` for a run, or `null` if it has no events yet (SSE head cursor). */
export function latestSeqForRun(db: Db, runId: string): number | null {
  return maxSeqForRun(db, runId);
}

function toEnvelope(row: typeof runtimeEvents.$inferSelect): EventEnvelope | null {
  const parsed = eventEnvelopeSchema.safeParse({
    id: row.id,
    run_id: row.run_id,
    step_run_id: row.step_run_id,
    agent_session_id: row.agent_session_id,
    seq: row.seq,
    type: row.type,
    source: row.source,
    occurred_at: row.occurred_at,
    payload: row.payload,
    raw_ref: row.raw_ref,
  });
  return parsed.success ? parsed.data : null;
}
