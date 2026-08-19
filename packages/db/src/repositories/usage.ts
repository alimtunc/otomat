import type { UsageRunEvidence, UsageTurnEvidence } from "@otomat/domain";
import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, projects, runs, runtimeEvents } from "../schema/index.js";

/** `from` null reads the whole ledger; both bounds are UTC ISO instants, which persisted events always are. */
export interface UsageWindow {
  from: string | null;
  to: string;
}

const json = (path: string): SQL => sql`json_extract(${runtimeEvents.payload}, ${path})`;

/** Typed and bounded before it is read: text coerces to a silent zero, and a negative figure is not a count. */
const numeric = (path: string): SQL =>
  sql`CASE WHEN json_type(${runtimeEvents.payload}, ${path}) IN ('integer', 'real') AND ${json(path)} >= 0 THEN ${json(path)} END`;

const text = (path: string): SQL =>
  sql`CASE WHEN json_type(${runtimeEvents.payload}, ${path}) = 'text' THEN ${json(path)} END`;

function windowFilters(window: UsageWindow): SQL[] {
  const filters = [
    eq(runtimeEvents.type, "runtime.usage"),
    lte(runtimeEvents.occurred_at, window.to),
  ];
  if (window.from !== null) filters.push(gte(runtimeEvents.occurred_at, window.from));
  return filters;
}

export function listUsageTurns(db: Db, window: UsageWindow): UsageTurnEvidence[] {
  const day = sql<string>`substr(${runtimeEvents.occurred_at}, 1, 10)`;
  const runtime = text("$.adapter");
  const model = text("$.usage.model");
  return db
    .select({
      run_id: runtimeEvents.run_id,
      step_run_id: runtimeEvents.step_run_id,
      day,
      last_occurred_at: sql<string>`max(${runtimeEvents.occurred_at})`,
      runtime: sql<string | null>`${runtime}`,
      model: sql<string | null>`${model}`,
      turns: sql<number>`count(*)`,
      unreadable_turns: sql<number>`sum(CASE WHEN json_type(${runtimeEvents.payload}, '$.usage') = 'object' THEN 0 ELSE 1 END)`,
      input_tokens: sql<number | null>`sum(${numeric("$.usage.input_tokens")})`,
      input_turns: sql<number>`count(${numeric("$.usage.input_tokens")})`,
      output_tokens: sql<number | null>`sum(${numeric("$.usage.output_tokens")})`,
      output_turns: sql<number>`count(${numeric("$.usage.output_tokens")})`,
      cost_usd: sql<number | null>`sum(${numeric("$.usage.cost_usd")})`,
      cost_turns: sql<number>`count(${numeric("$.usage.cost_usd")})`,
    })
    .from(runtimeEvents)
    .where(and(...windowFilters(window)))
    .groupBy(runtimeEvents.run_id, runtimeEvents.step_run_id, day, runtime, model)
    .all();
}

/** Matched through a subquery so a long history never becomes a parameter list. */
export function listUsageRuns(db: Db, window: UsageWindow): UsageRunEvidence[] {
  const reported = db
    .selectDistinct({ run_id: runtimeEvents.run_id })
    .from(runtimeEvents)
    .where(and(...windowFilters(window)));
  return db
    .select({
      run_id: runs.id,
      status: runs.status,
      started_at: runs.started_at,
      completed_at: runs.completed_at,
      project_id: projects.id,
      project_name: projects.name,
      issue_id: issues.id,
      issue_identifier: issues.source_identifier,
      issue_title: issues.title,
    })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .innerJoin(projects, eq(issues.project_id, projects.id))
    .where(inArray(runs.id, reported))
    .all();
}
