import type { RunContributionState } from "@otomat/domain";
import { and, eq, inArray, max, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { runContributions } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewRunContribution = typeof runContributions.$inferInsert;
export type RunContributionRow = typeof runContributions.$inferSelect;

export interface AppendRunContribution {
  id: string;
  run_id: string;
  body: string;
}

/**
 * Appends one contribution at the end of the run's FIFO queue. The read of the
 * current tail and the insert share one immediate transaction, so two concurrent
 * posts get distinct `seq` values instead of colliding on the unique index.
 */
export function appendRunContribution(db: Db, value: AppendRunContribution): RunContributionRow {
  return db.transaction(
    () => {
      const tail = db
        .select({ seq: max(runContributions.seq) })
        .from(runContributions)
        .where(eq(runContributions.run_id, value.run_id))
        .get();
      const row = db
        .insert(runContributions)
        .values({ ...value, seq: (tail?.seq ?? -1) + 1 })
        .returning()
        .get();
      return row;
    },
    { behavior: "immediate" },
  );
}

export function getRunContribution(db: Db, id: string): RunContributionRow | undefined {
  return db.select().from(runContributions).where(eq(runContributions.id, id)).get();
}

export function listRunContributions(db: Db, runId: string): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(eq(runContributions.run_id, runId))
    .orderBy(runContributions.seq)
    .all();
}

export function listRunContributionsByStatus(
  db: Db,
  runId: string,
  status: RunContributionState,
): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(and(eq(runContributions.run_id, runId), eq(runContributions.status, status)))
    .orderBy(runContributions.seq)
    .all();
}

/** Every contribution still claiming a delivery, across runs; the boot pass resolves these against session evidence. */
export function listClaimedRunContributions(db: Db): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(
      and(
        eq(runContributions.status, "queued"),
        sql`${runContributions.agent_session_id} is not null`,
      ),
    )
    .orderBy(runContributions.run_id, runContributions.seq)
    .all();
}

function patchRunContributions(
  db: Db,
  ids: readonly string[],
  set: Partial<NewRunContribution>,
): void {
  if (ids.length === 0) return;
  db.update(runContributions)
    .set(touch(set))
    .where(inArray(runContributions.id, [...ids]))
    .run();
}

/** Records which session a batch is about to be handed to, before the turn is spawned. The batch stays `queued`. */
export function claimRunContributions(
  db: Db,
  ids: readonly string[],
  agentSessionId: string,
): void {
  if (ids.length === 0) return;
  db.update(runContributions)
    .set(
      touch({
        agent_session_id: agentSessionId,
        attempts: sql`${runContributions.attempts} + 1`,
        error: null,
      }),
    )
    .where(inArray(runContributions.id, [...ids]))
    .run();
}

/** Marks a claimed batch delivered once its turn is launched — the only path to `sent`. */
export function markRunContributionsSent(db: Db, ids: readonly string[], at: string): void {
  patchRunContributions(db, ids, { status: "sent", delivered_at: at });
}

export function markRunContributionsSettled(
  db: Db,
  ids: readonly string[],
  status: Extract<RunContributionState, "completed" | "failed">,
  at: string,
  error: string | null = null,
): void {
  patchRunContributions(db, ids, { status, settled_at: at, error });
}

/** A delivery that never launched: the claim is dropped so the message can be retried without duplicating a provider effect. */
export function markRunContributionsFailed(db: Db, ids: readonly string[], error: string): void {
  patchRunContributions(db, ids, { status: "failed", agent_session_id: null, error });
}

/** Drops a claim whose turn is proven never to have launched, returning the contribution to the queue. */
export function releaseRunContributionClaim(db: Db, id: string): void {
  patchRunContributions(db, [id], { agent_session_id: null });
}

/** Re-queues a failed contribution for another delivery attempt. */
export function requeueRunContribution(db: Db, id: string): void {
  patchRunContributions(db, [id], {
    status: "queued",
    agent_session_id: null,
    error: null,
    settled_at: null,
  });
}

/** Contributions handed to one session, oldest first; the settle path resolves them from that turn's outcome. */
export function listRunContributionsForSession(
  db: Db,
  agentSessionId: string,
): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(eq(runContributions.agent_session_id, agentSessionId))
    .orderBy(runContributions.seq)
    .all();
}
