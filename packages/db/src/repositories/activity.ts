import { RUN_SETTLED_STATES, STEP_RUN_SETTLED_STATES, type ActivityEvidence } from "@otomat/domain";
import { and, asc, eq, gte, inArray, isNotNull, isNull, notInArray, or } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, projects, pullRequests, runs, stepRuns } from "../schema/index.js";
import { isoToSqlite, sqliteToIso } from "./instants.js";

/** The step a run is working through, lowest index first, so a run reports the step it is on rather than the last one written. */
function currentSteps(db: Db, runIds: string[]): Map<string, string> {
  const held = new Map<string, string>();
  for (const row of db
    .select({ run_id: stepRuns.run_id, name: stepRuns.name })
    .from(stepRuns)
    .where(
      and(
        inArray(stepRuns.run_id, runIds),
        notInArray(stepRuns.status, [...STEP_RUN_SETTLED_STATES]),
      ),
    )
    .orderBy(asc(stepRuns.idx))
    .all()) {
    if (!held.has(row.run_id)) held.set(row.run_id, row.name);
  }
  return held;
}

/** Highest index wins, so a fail-fast cascade's earlier casualties never stand in for the step that stopped the run. */
function haltedSteps(db: Db, runIds: string[]): Map<string, string> {
  return new Map(
    db
      .select({ run_id: stepRuns.run_id, name: stepRuns.name })
      .from(stepRuns)
      .where(and(inArray(stepRuns.run_id, runIds), inArray(stepRuns.status, ["failed", "stale"])))
      .orderBy(asc(stepRuns.idx))
      .all()
      .map((row) => [row.run_id, row.name]),
  );
}

/** `since` bounds only settled work: an unabandoned failure — run or publication — stays fetched at any age, because `projectActivities` never windows the attention bucket. */
export function listActivityEvidence(db: Db, since: string): ActivityEvidence[] {
  const bound = isoToSqlite(since);
  const rows = db
    .select({
      run_id: runs.id,
      run_status: runs.status,
      run_updated_at: runs.updated_at,
      issue_id: issues.id,
      issue_identifier: issues.source_identifier,
      issue_title: issues.title,
      project_id: projects.id,
      project_name: projects.name,
      pullRequest: pullRequests,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .innerJoin(projects, eq(issues.project_id, projects.id))
    .leftJoin(pullRequests, and(eq(pullRequests.run_id, runs.id), isNull(pullRequests.detached_at)))
    .where(
      or(
        notInArray(runs.status, [...RUN_SETTLED_STATES]),
        and(eq(runs.status, "failed"), isNull(runs.abandoned_at)),
        gte(runs.updated_at, bound),
        gte(pullRequests.updated_at, bound),
        and(eq(pullRequests.publication_status, "failed"), isNull(runs.abandoned_at)),
        and(
          eq(pullRequests.publication_status, "not_configured"),
          isNotNull(pullRequests.error_code),
          isNull(runs.abandoned_at),
        ),
      ),
    )
    .all();
  if (rows.length === 0) return [];
  const runIds = rows.map((row) => row.run_id);
  const current = currentSteps(db, runIds);
  const halted = haltedSteps(db, runIds);
  return rows.map(({ pullRequest, ...row }) => ({
    ...row,
    run_updated_at: sqliteToIso(row.run_updated_at),
    current_step: current.get(row.run_id) ?? null,
    halted_step: halted.get(row.run_id) ?? null,
    publication: toPublication(pullRequest),
  }));
}

function toPublication(
  pullRequest: typeof pullRequests.$inferSelect | null,
): ActivityEvidence["publication"] {
  if (pullRequest === null) return null;
  return {
    id: pullRequest.id,
    publication_status: pullRequest.publication_status,
    failed_phase: pullRequest.failed_phase,
    error_code: pullRequest.error_code,
    error_message: pullRequest.error_message,
    updated_at: sqliteToIso(pullRequest.updated_at),
  };
}
