import type { ResolvedAgentConfig, StepProviderWait, StepRunState } from "@otomat/domain";
import { and, asc, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { runs, stepRuns } from "../schema/index.js";
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

export function setStepProviderWait(db: Db, id: string, wait: StepProviderWait | null): void {
  db.update(stepRuns)
    .set(touch({ provider_wait_json: wait }))
    .where(eq(stepRuns.id, id))
    .run();
}

export function setStepNextTurnConfig(
  db: Db,
  id: string,
  config: ResolvedAgentConfig | null,
): StepRunRow {
  return db
    .update(stepRuns)
    .set(touch({ next_turn_config_json: config }))
    .where(eq(stepRuns.id, id))
    .returning()
    .get();
}

/** One suspended step and the identity of the run holding it; the plan is deliberately not read — the resume re-reads the run itself. */
export interface WaitingProviderStep {
  step: StepRunRow;
  run_id: string;
  issue_id: string;
}

/**
 * The scheduler's whole queue: every step suspended on a provider quota whose run
 * is waiting too, oldest wait first. The run's own state is part of the filter
 * because a resume takes the workspace, and only a run at rest has it free.
 */
export function listStepsWaitingForProvider(db: Db): WaitingProviderStep[] {
  return db
    .select({ step: stepRuns, run_id: runs.id, issue_id: runs.issue_id })
    .from(stepRuns)
    .innerJoin(runs, eq(stepRuns.run_id, runs.id))
    .where(
      and(eq(stepRuns.status, "waiting_for_provider"), eq(runs.status, "waiting_for_provider")),
    )
    .orderBy(asc(stepRuns.updated_at), asc(stepRuns.idx))
    .all();
}
