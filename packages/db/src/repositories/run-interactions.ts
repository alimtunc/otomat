import type { RuntimeInteractionAnswer, RuntimeInteractionQuestion } from "@otomat/domain";
import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "../client.js";
import { runInteractions } from "../schema/index.js";
import { touch } from "./touch.js";

export type RunInteractionRow = typeof runInteractions.$inferSelect;

export interface RecordRunInteraction {
  id: string;
  run_id: string;
  step_run_id: string;
  agent_session_id: string;
  provider_request_id: string;
  kind: RunInteractionRow["kind"];
  prompt: string;
  tool: string | null;
  reason: string | null;
  questions_json: RuntimeInteractionQuestion[];
  requested_at: string;
}

/** Records a request the runtime made; a request already recorded for that session keeps its row, so a replayed ingest changes nothing. */
export function recordRunInteraction(db: Db, value: RecordRunInteraction): void {
  db.insert(runInteractions).values(value).onConflictDoNothing().run();
}

export function getRunInteraction(db: Db, id: string): RunInteractionRow | undefined {
  return db.select().from(runInteractions).where(eq(runInteractions.id, id)).get();
}

export function listRunInteractions(db: Db, runId: string): RunInteractionRow[] {
  return db
    .select()
    .from(runInteractions)
    .where(eq(runInteractions.run_id, runId))
    .orderBy(runInteractions.requested_at, runInteractions.id)
    .all();
}

export function listPendingRunInteractions(db: Db, runId: string): RunInteractionRow[] {
  return db
    .select()
    .from(runInteractions)
    .where(and(eq(runInteractions.run_id, runId), eq(runInteractions.state, "pending")))
    .orderBy(runInteractions.requested_at, runInteractions.id)
    .all();
}

export function listPendingRunInteractionsForSession(
  db: Db,
  agentSessionId: string,
): RunInteractionRow[] {
  return db
    .select()
    .from(runInteractions)
    .where(
      and(
        eq(runInteractions.agent_session_id, agentSessionId),
        eq(runInteractions.state, "pending"),
      ),
    )
    .orderBy(runInteractions.requested_at, runInteractions.id)
    .all();
}

/** Settles one request with the operator's answer, scoped to `pending`; an undefined row means a concurrent command already settled it and this one wrote nothing. */
export function answerRunInteraction(
  db: Db,
  id: string,
  answer: RuntimeInteractionAnswer,
  at: string,
): RunInteractionRow | undefined {
  return db
    .update(runInteractions)
    .set(touch({ state: "answered", answer_json: answer, settled_at: at }))
    .where(and(eq(runInteractions.id, id), eq(runInteractions.state, "pending")))
    .returning()
    .all()
    .at(0);
}

export function cancelRunInteractions(
  db: Db,
  ids: readonly string[],
  reason: string,
  at: string,
): void {
  if (ids.length === 0) return;
  db.update(runInteractions)
    .set(touch({ state: "canceled", canceled_reason: reason, settled_at: at }))
    .where(and(inArray(runInteractions.id, [...ids]), eq(runInteractions.state, "pending")))
    .run();
}
