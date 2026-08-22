import type { AgentSessionState, SessionContext } from "@otomat/domain";
import { and, eq, getTableColumns, isNull, max } from "drizzle-orm";

import type { Db } from "#db/client";

import { agentSessions, stepRuns } from "../schema.js";
import { touch } from "../touch.js";

export type NewAgentSession = typeof agentSessions.$inferInsert;
export type AgentSessionRow = typeof agentSessions.$inferSelect;

export function insertAgentSession(db: Db, value: NewAgentSession): void {
  const tail = db
    .select({ index: max(agentSessions.turn_index) })
    .from(agentSessions)
    .where(eq(agentSessions.step_run_id, value.step_run_id))
    .get();
  db.insert(agentSessions)
    .values({ ...value, turn_index: value.turn_index ?? (tail?.index ?? -1) + 1 })
    .run();
}

export function listAgentSessionsForRun(db: Db, runId: string): AgentSessionRow[] {
  return db
    .select(getTableColumns(agentSessions))
    .from(agentSessions)
    .innerJoin(stepRuns, eq(agentSessions.step_run_id, stepRuns.id))
    .where(eq(stepRuns.run_id, runId))
    .orderBy(stepRuns.idx, agentSessions.turn_index)
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
  const values: Partial<typeof agentSessions.$inferInsert> = { status };
  if (status === "active") values.started_at = new Date().toISOString();
  patchAgentSession(db, id, values);
}

export function recordAgentSessionReportedModel(db: Db, id: string, model: string): void {
  patchAgentSession(db, id, { reported_model: model });
}

/** Persist the provider session id (the resume key) once the runtime reports it. */
export function updateAgentSessionProvider(db: Db, id: string, providerSessionId: string): void {
  patchAgentSession(db, id, { provider_session_id: providerSessionId });
}

/** Recorded before the provider is spawned, so what the agent received stays auditable whatever the turn then does. */
export function recordAgentSessionContext(db: Db, id: string, context: SessionContext): void {
  patchAgentSession(db, id, { context_json: context });
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

/** One end of a pass's git boundary: the tree the worktree stood at, and the commit it was on. */
export interface SessionBoundaryCapture {
  treeSha: string;
  headSha: string;
}

/** Written once per row: a resume reuses its session, and the pass's delta must still start where its first turn did. */
export function recordSessionPassStart(db: Db, id: string, capture: SessionBoundaryCapture): void {
  db.update(agentSessions)
    .set(
      touch({
        start_tree_sha: capture.treeSha,
        start_head_sha: capture.headSha,
        boundary_error: null,
      }),
    )
    .where(and(eq(agentSessions.id, id), isNull(agentSessions.start_tree_sha)))
    .run();
}

export function recordSessionPassEnd(db: Db, id: string, capture: SessionBoundaryCapture): void {
  patchAgentSession(db, id, { end_tree_sha: capture.treeSha, end_head_sha: capture.headSha });
}

export function recordSessionBoundaryError(db: Db, id: string, reason: string): void {
  patchAgentSession(db, id, { boundary_error: reason });
}
