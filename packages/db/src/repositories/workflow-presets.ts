import { workflowPresetPlanSchema, type WorkflowPresetPlan } from "@otomat/domain";
import { and, eq, isNull, or, type SQL } from "drizzle-orm";

import type { Db } from "../client.js";
import { workflowPresets } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewWorkflowPreset = Omit<typeof workflowPresets.$inferInsert, "plan_json"> & {
  plan_json: WorkflowPresetPlan;
};

export type WorkflowPresetRow = Omit<typeof workflowPresets.$inferSelect, "plan_json"> & {
  plan_json: WorkflowPresetPlan;
};

function hydrate(row: typeof workflowPresets.$inferSelect): WorkflowPresetRow {
  return { ...row, plan_json: workflowPresetPlanSchema.parse(row.plan_json) };
}

export function insertWorkflowPreset(db: Db, value: NewWorkflowPreset): void {
  db.insert(workflowPresets).values(value).run();
}

/** Throws (Zod) when the row's `plan_json` is corrupt; `undefined` means no row matched `id`. */
export function getWorkflowPreset(db: Db, id: string): WorkflowPresetRow | undefined {
  const row = db.select().from(workflowPresets).where(eq(workflowPresets.id, id)).get();
  return row ? hydrate(row) : undefined;
}

/** What is reusable from one project: every global preset plus that project's own. */
export function listWorkflowPresets(
  db: Db,
  options: { projectId?: string } = {},
): WorkflowPresetRow[] {
  const visible = options.projectId
    ? or(isNull(workflowPresets.project_id), eq(workflowPresets.project_id, options.projectId))
    : isNull(workflowPresets.project_id);
  return db
    .select()
    .from(workflowPresets)
    .where(visible)
    .orderBy(workflowPresets.name)
    .all()
    .map(hydrate);
}

/** The preset a name would collide with inside one scope, so a save can refuse instead of shadowing it. */
export function findWorkflowPresetByName(
  db: Db,
  scope: { name: string; projectId: string | null },
): WorkflowPresetRow | undefined {
  const owner: SQL | undefined = scope.projectId
    ? eq(workflowPresets.project_id, scope.projectId)
    : isNull(workflowPresets.project_id);
  const row = db
    .select()
    .from(workflowPresets)
    .where(and(eq(workflowPresets.name, scope.name), owner))
    .get();
  return row ? hydrate(row) : undefined;
}

export function updateWorkflowPreset(
  db: Db,
  id: string,
  columns: Omit<NewWorkflowPreset, "id">,
): void {
  db.update(workflowPresets).set(touch(columns)).where(eq(workflowPresets.id, id)).run();
}

export function deleteWorkflowPreset(db: Db, id: string): void {
  db.delete(workflowPresets).where(eq(workflowPresets.id, id)).run();
}
