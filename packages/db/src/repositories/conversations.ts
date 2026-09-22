import type { ConversationEvidence } from "@otomat/domain";
import { and, eq, exists, gte, inArray, ne, or, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import {
  agentSessions,
  issues,
  projects,
  runContributions,
  runs,
  stepRuns,
} from "../schema/index.js";
import {
  attachContributions,
  attachInteractions,
  attachParticipants,
  latestAgentMessages,
  type ConversationThreads,
} from "./conversation-facts.js";
import { isoToSqlite, sqliteToIso } from "./instants.js";

/** A followed run's threads are listed at any age; any other run's only while it moved after `since`. */
interface ConversationScope {
  followed_run_ids: readonly string[];
  since: string;
}

/** One row per step in scope that has a session or a message: a queued step nobody wrote to has no thread yet. */
function listThreadRows(db: Db, scope: ConversationScope) {
  const bound = isoToSqlite(scope.since);
  const hasSession = exists(
    db
      .select({ one: sql`1` })
      .from(agentSessions)
      .where(eq(agentSessions.step_run_id, stepRuns.id)),
  );
  const hasMessage = exists(
    db
      .select({ one: sql`1` })
      .from(runContributions)
      .where(eq(runContributions.step_run_id, stepRuns.id)),
  );
  return db
    .select({
      step_run_id: stepRuns.id,
      step_name: stepRuns.name,
      step_status: stepRuns.status,
      step_created_at: stepRuns.created_at,
      step_updated_at: stepRuns.updated_at,
      run_id: runs.id,
      run_status: runs.status,
      run_abandoned_at: runs.abandoned_at,
      plan_json: runs.plan_json,
      issue_id: issues.id,
      issue_identifier: issues.source_identifier,
      issue_title: issues.title,
      project_id: projects.id,
      project_name: projects.name,
    })
    .from(stepRuns)
    .innerJoin(runs, eq(stepRuns.run_id, runs.id))
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .innerJoin(projects, eq(issues.project_id, projects.id))
    .where(
      and(
        or(inArray(runs.id, [...scope.followed_run_ids]), gte(runs.updated_at, bound)),
        ne(stepRuns.status, "withdrawn"),
        or(hasSession, hasMessage),
      ),
    )
    .all();
}

export function listConversationEvidence(db: Db, scope: ConversationScope): ConversationEvidence[] {
  const rows = listThreadRows(db, scope);
  if (rows.length === 0) return [];
  const runIds = [...new Set(rows.map((row) => row.run_id))];
  const messages = latestAgentMessages(db, runIds);
  const threads: ConversationThreads = new Map(
    rows.map((row) => [
      row.step_run_id,
      {
        step_run_id: row.step_run_id,
        step_name: row.step_name,
        step_status: row.step_status,
        step_created_at: sqliteToIso(row.step_created_at),
        step_updated_at: sqliteToIso(row.step_updated_at),
        run_id: row.run_id,
        run_status: row.run_status,
        run_abandoned_at: row.run_abandoned_at,
        issue_id: row.issue_id,
        issue_identifier: row.issue_identifier,
        issue_title: row.issue_title,
        project_id: row.project_id,
        project_name: row.project_name,
        config: null,
        reported_model: null,
        last_agent_message: messages.get(row.step_run_id) ?? null,
        last_user_message: null,
        pending_interaction: null,
        queued_contributions: 0,
        failed_contribution_at: null,
      },
    ]),
  );
  attachContributions(db, runIds, threads);
  attachInteractions(db, runIds, threads);
  attachParticipants(db, rows, threads);
  return [...threads.values()];
}
