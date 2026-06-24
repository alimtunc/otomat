import type { AgentSessionState } from "@otomat/domain";
import { eq, getTableColumns, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { agentSessions, stepRuns } from "../schema/index.js";

export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentSessionRow = typeof agentSessions.$inferSelect;

export function insertAgentSession(db: Db, value: NewAgentSession): void {
  db.insert(agentSessions).values(value).run();
}

export function getAgentSession(db: Db, id: string): AgentSessionRow | undefined {
  return db.select().from(agentSessions).where(eq(agentSessions.id, id)).get();
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

/** Persist the provider session id (the resume key) once the runtime reports it. */
export function updateAgentSessionProvider(db: Db, id: string, providerSessionId: string): void {
  db.update(agentSessions)
    .set({ provider_session_id: providerSessionId, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(agentSessions.id, id))
    .run();
}

/** Process liveness recorded when the supervisor spawns the session's child process. */
export interface AgentSessionProcess {
  pid: number;
  pgid: number;
  started_at: string;
  last_seen: string;
}

export function recordAgentSessionProcess(db: Db, id: string, process: AgentSessionProcess): void {
  db.update(agentSessions)
    .set({ ...process, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(agentSessions.id, id))
    .run();
}

/** Final process accounting written once the supervisor observes the child exit. */
export interface AgentSessionExit {
  exit_code: number | null;
  exit_signal: string | null;
  last_seen: string;
}

export function recordAgentSessionExit(db: Db, id: string, exit: AgentSessionExit): void {
  db.update(agentSessions)
    .set({ ...exit, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(agentSessions.id, id))
    .run();
}
