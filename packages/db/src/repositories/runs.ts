import { runPlanSchema, type RunPlan } from "@otomat/domain";
import { eq } from "drizzle-orm";

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
