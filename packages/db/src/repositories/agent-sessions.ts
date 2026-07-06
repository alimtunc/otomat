import type { AgentSessionState } from "@otomat/domain";
import { eq, getTableColumns } from "drizzle-orm";

import type { Db } from "../client.js";
import { agentSessions, stepRuns } from "../schema/index.js";
import { touch } from "./touch.js";

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

function patchAgentSession(
  db: Db,
  id: string,
  set: Partial<typeof agentSessions.$inferInsert>,
): void {
  db.update(agentSessions).set(touch(set)).where(eq(agentSessions.id, id)).run();
}

export function updateAgentSessionStatus(db: Db, id: string, status: AgentSessionState): void {
  patchAgentSession(db, id, { status });
}

/** Persist the provider session id (the resume key) once the runtime reports it. */
export function updateAgentSessionProvider(db: Db, id: string, providerSessionId: string): void {
  patchAgentSession(db, id, { provider_session_id: providerSessionId });
}

/** The child process ids recorded when the supervisor spawns a session, so reconciliation can probe them. */
export interface AgentSessionProcess {
  pid: number;
  pgid: number;
}

export function recordAgentSessionProcess(db: Db, id: string, process: AgentSessionProcess): void {
  patchAgentSession(db, id, process);
}

/** Final process accounting written once the supervisor observes the child exit. */
export interface AgentSessionExit {
  exit_code: number | null;
  exit_signal: string | null;
}

export function recordAgentSessionExit(db: Db, id: string, exit: AgentSessionExit): void {
  patchAgentSession(db, id, exit);
}
