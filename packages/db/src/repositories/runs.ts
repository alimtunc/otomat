import { RUN_TERMINAL_STATES, runPlanSchema, type RunPlan, type RunState } from "@otomat/domain";
import { eq, notInArray, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { runs } from "../schema/index.js";

export type NewRun = Omit<typeof runs.$inferInsert, "plan_json"> & {
  plan_json: RunPlan;
};
export type RunRow = Omit<typeof runs.$inferSelect, "plan_json"> & {
  plan_json: RunPlan;
};

export function insertRun(db: Db, value: NewRun): void {
  db.insert(runs).values(value).run();
}

export function getRun(db: Db, id: string): RunRow | undefined {
  const row = db.select().from(runs).where(eq(runs.id, id)).get();
  if (!row) return undefined;
  return { ...row, plan_json: runPlanSchema.parse(row.plan_json) };
}

/** User-facing list: a corrupt `plan_json` throws (fail loud) rather than silently hiding a run. */
export function listRuns(db: Db, options: { issueId?: string } = {}): RunRow[] {
  return db
    .select()
    .from(runs)
    .where(options.issueId ? eq(runs.issue_id, options.issueId) : undefined)
    .orderBy(runs.created_at)
    .all()
    .map((row) => ({ ...row, plan_json: runPlanSchema.parse(row.plan_json) }));
}

export interface CorruptActiveRun {
  id: string;
  status: RunState;
  issues: unknown;
}

export interface ActiveRuns {
  runs: RunRow[];
  corrupt: CorruptActiveRun[];
}

/** Boot reconciliation work-list; unlike `listRuns`, a corrupt `plan_json` row is returned separately so the caller can settle it instead of hiding it. */
export function listActiveRuns(db: Db): ActiveRuns {
  const active: ActiveRuns = { runs: [], corrupt: [] };
  for (const row of db
    .select()
    .from(runs)
    .where(notInArray(runs.status, [...RUN_TERMINAL_STATES]))
    .orderBy(runs.created_at)
    .all()) {
    const parsed = runPlanSchema.safeParse(row.plan_json);
    if (parsed.success) {
      active.runs.push({ ...row, plan_json: parsed.data });
    } else {
      active.corrupt.push({ id: row.id, status: row.status, issues: parsed.error.issues });
    }
  }
  return active;
}

export interface RunStatusUpdate {
  status: RunState;
  started_at?: string;
  completed_at?: string;
}

export function updateRunStatus(db: Db, id: string, update: RunStatusUpdate): void {
  db.update(runs)
    .set({ ...update, updated_at: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(runs.id, id))
    .run();
}
