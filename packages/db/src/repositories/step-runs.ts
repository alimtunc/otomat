import type { StepRunState } from "@otomat/domain";
import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { stepRuns } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewStepRun = typeof stepRuns.$inferInsert;
export type StepRunRow = typeof stepRuns.$inferSelect;

export function insertStepRun(db: Db, value: NewStepRun): void {
  db.insert(stepRuns).values(value).run();
}

export function getStepRun(db: Db, id: string): StepRunRow | undefined {
  return db.select().from(stepRuns).where(eq(stepRuns.id, id)).get();
}

export function listStepRunsForRun(db: Db, runId: string): StepRunRow[] {
  return db.select().from(stepRuns).where(eq(stepRuns.run_id, runId)).orderBy(stepRuns.idx).all();
}

export function updateStepRunStatus(db: Db, id: string, status: StepRunState): void {
  db.update(stepRuns).set(touch({ status })).where(eq(stepRuns.id, id)).run();
}

export function attachStepWorktree(db: Db, id: string, worktreeId: string): void {
  db.update(stepRuns)
    .set(touch({ worktree_id: worktreeId }))
    .where(eq(stepRuns.id, id))
    .run();
}
