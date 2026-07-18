import { RUN_TERMINAL_STATES, runPlanSchema, type RunPlan, type RunState } from "@otomat/domain";
import { and, eq, notInArray, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues, runs } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewRun = Omit<typeof runs.$inferInsert, "plan_json"> & {
  plan_json: RunPlan;
};
export type RunRow = Omit<typeof runs.$inferSelect, "plan_json"> & {
  plan_json: RunPlan;
};

export function insertRun(db: Db, value: NewRun): void {
  db.insert(runs).values(value).run();
}

/** Throws (Zod) when the matched row's `plan_json` is corrupt; `undefined` means no row matched `id`, never a corrupt plan. */
export function getRun(db: Db, id: string): RunRow | undefined {
  const row = db.select().from(runs).where(eq(runs.id, id)).get();
  if (!row) return undefined;
  return { ...row, plan_json: runPlanSchema.parse(row.plan_json) };
}

/** User-facing list: a corrupt `plan_json` throws (fail loud) rather than silently hiding a run. `projectId` filters through each run's issue. */
export function listRuns(db: Db, options: { issueId?: string; projectId?: string } = {}): RunRow[] {
  const filters: SQL[] = [];
  if (options.issueId) filters.push(eq(runs.issue_id, options.issueId));
  if (options.projectId) filters.push(eq(issues.project_id, options.projectId));
  return db
    .select({ runs })
    .from(runs)
    .innerJoin(issues, eq(runs.issue_id, issues.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(runs.created_at)
    .all()
    .map(({ runs: row }) => ({ ...row, plan_json: runPlanSchema.parse(row.plan_json) }));
}

/** A run whose `plan_json` failed to parse; `issues` is the Zod validation problems from that parse (a `ZodError.issues` array) — not domain issues. */
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
  db.update(runs).set(touch(update)).where(eq(runs.id, id)).run();
}
