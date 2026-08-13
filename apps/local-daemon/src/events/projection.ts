import { schema, type Db } from "@otomat/db";
import { eventEnvelopeSchema, type EventEnvelope } from "@otomat/domain";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";

const { runtimeEvents } = schema;

const WINDOW_DEFAULT_LIMIT = 200;
const WINDOW_MAX_LIMIT = 500;

export interface ReadRunEventsOptions {
  /** Only events whose `seq` is strictly greater than this (SSE catch-up cursor). */
  afterSeq?: number;
  limit?: number;
}

export interface RunEventProjection {
  events: EventEnvelope[];
  corruptEventCount: number;
}

export interface ReadRunEventWindowOptions {
  /** Only events whose `seq` is strictly below this (the window's backwards cursor). */
  before?: number;
  limit?: number;
}

export interface RunEventWindowProjection {
  events: EventEnvelope[];
  olderCursor: number | null;
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
  return readRunEventProjection(db, runId, options).events;
}

export function readRunEventProjection(
  db: Db,
  runId: string,
  options: ReadRunEventsOptions = {},
): RunEventProjection {
  const where =
    options.afterSeq === undefined
      ? eq(runtimeEvents.run_id, runId)
      : and(eq(runtimeEvents.run_id, runId), gt(runtimeEvents.seq, options.afterSeq));

  const base = db.select().from(runtimeEvents).where(where).orderBy(asc(runtimeEvents.seq));
  const rows = options.limit === undefined ? base.all() : base.limit(options.limit).all();
  const events = rows.map(toEnvelope);
  return {
    events: events.filter((event): event is EventEnvelope => event !== null),
    corruptEventCount: events.filter((event) => event === null).length,
  };
}

/** The cursor comes from the rows read, not the surviving envelopes, so a corrupt edge row cannot strand the walk. */
export function readRunEventWindow(
  db: Db,
  runId: string,
  options: ReadRunEventWindowOptions = {},
): RunEventWindowProjection {
  const limit = Math.min(Math.max(options.limit ?? WINDOW_DEFAULT_LIMIT, 1), WINDOW_MAX_LIMIT);
  const where =
    options.before === undefined
      ? eq(runtimeEvents.run_id, runId)
      : and(eq(runtimeEvents.run_id, runId), lt(runtimeEvents.seq, options.before));

  const rows = db
    .select()
    .from(runtimeEvents)
    .where(where)
    .orderBy(desc(runtimeEvents.seq))
    .limit(limit + 1)
    .all();
  const hasOlder = rows.length > limit;
  const page = rows.slice(0, limit).toReversed();

  return {
    events: page.map(toEnvelope).filter((event): event is EventEnvelope => event !== null),
    olderCursor: hasOlder ? page[0].seq : null,
  };
}

/** The newest messages one step emitted, newest first. Bounded at the query: a caller after a step's last words must never read the run's whole ledger. */
export function readStepMessages(
  db: Db,
  runId: string,
  stepRunId: string,
  limit: number,
): EventEnvelope[] {
  return db
    .select()
    .from(runtimeEvents)
    .where(
      and(
        eq(runtimeEvents.run_id, runId),
        eq(runtimeEvents.step_run_id, stepRunId),
        eq(runtimeEvents.type, "runtime.message"),
      ),
    )
    .orderBy(desc(runtimeEvents.seq))
    .limit(limit)
    .all()
    .map(toEnvelope)
    .filter((event): event is EventEnvelope => event !== null);
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
