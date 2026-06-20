import type { AgentSessionState } from "@otomat/domain";
import { eq, getTableColumns, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { agentSessions, stepRuns } from "../schema/index.js";

export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentSessionRow = typeof agentSessions.$inferSelect;

export function insertAgentSession(db: Db, value: NewAgentSession): void {
  db.insert(agentSessions).values(value).run();
}

export function listAgentSessionsForRun(db: Db, runId: string): AgentSessionRow[] {
  return db
    .select(getTableColumns(agentSessions))
    .from(agentSessions)
    .innerJoin(stepRuns, eq(agentSessions.step_run_id, stepRuns.id))
    .where(eq(stepRuns.run_id, runId))
    .orderBy(agentSessions.created_at)
    .all();
}

export function updateAgentSessionStatus(db: Db, id: string, status: AgentSessionState): void {
  db.update(agentSessions)
    .set({ status, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(agentSessions.id, id))
    .run();
}
