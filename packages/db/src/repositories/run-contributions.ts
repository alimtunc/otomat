import type { RunContributionState } from "@otomat/domain";
import { and, eq, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";

import type { Db } from "../client.js";
import { runContributions } from "../schema/index.js";
import { touch } from "./touch.js";

export type RunContributionRow = typeof runContributions.$inferSelect;

export interface AppendRunContribution {
  id: string;
  run_id: string;
  step_run_id: string;
  body: string;
}

/** The tail read and the insert share one immediate transaction, so concurrent posts get distinct `seq` values. */
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

/** Queued and unclaimed: a claimed row is already riding a turn being spawned, so a second claim would deliver it twice. */
const claimable = and(
  eq(runContributions.status, "queued"),
  isNull(runContributions.agent_session_id),
);

/** The run's undelivered queue in send order, across every step. */
export function listClaimableRunContributions(db: Db, runId: string): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(and(eq(runContributions.run_id, runId), claimable))
    .orderBy(runContributions.seq)
    .all();
}

/** One step's queue in send order; a delivery turn carries exactly its own step's batch. */
export function listClaimableStepContributions(db: Db, stepRunId: string): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(and(eq(runContributions.step_run_id, stepRunId), claimable))
    .orderBy(runContributions.seq)
    .all();
}

/** Every contribution still claiming a delivery, across runs; the boot pass resolves these against session evidence. */
export function listClaimedRunContributions(db: Db): RunContributionRow[] {
  return db
    .select()
    .from(runContributions)
    .where(and(eq(runContributions.status, "queued"), isNotNull(runContributions.agent_session_id)))
    .orderBy(runContributions.run_id, runContributions.seq)
    .all();
}

function patchRunContributions(
  db: Db,
  ids: readonly string[],
  set: SQLiteUpdateSetSource<typeof runContributions>,
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
  patchRunContributions(db, ids, {
    agent_session_id: agentSessionId,
    attempts: sql`${runContributions.attempts} + 1`,
    error: null,
  });
}

/** Marks a claimed batch delivered once its turn is launched — the only path to `delivered`. */
export function markRunContributionsDelivered(db: Db, ids: readonly string[], at: string): void {
  patchRunContributions(db, ids, { status: "delivered", delivered_at: at });
}

export function markRunContributionsSettled(
  db: Db,
  ids: readonly string[],
  status: Extract<RunContributionState, "acknowledged" | "failed">,
  at: string,
  error: string | null = null,
): void {
  patchRunContributions(db, ids, { status, settled_at: at, error });
}

/** A delivery that never launched: `settled_at` stays null and the claim is dropped, so the message is still retriable. */
export function failRunContributionDelivery(db: Db, ids: readonly string[], error: string): void {
  patchRunContributions(db, ids, { status: "failed", agent_session_id: null, error });
}

/** Drops a claim whose turn is proven never to have launched, returning the contributions to the queue. */
export function releaseRunContributionClaims(db: Db, ids: readonly string[]): void {
  patchRunContributions(db, ids, { agent_session_id: null });
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

/** Withdraws a message no turn ever carried; `error` is left alone so a prior delivery failure keeps its reason. */
export function cancelRunContribution(db: Db, id: string, at: string): void {
  patchRunContributions(db, [id], { status: "canceled", settled_at: at });
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
