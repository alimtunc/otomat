import type { Db } from "../client.js";
import { projects } from "../schema/index.js";

export type NewProject = typeof projects.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;

/** Idempotent: leaves an existing project untouched. Used for the daemon's default-project bootstrap. */
export function upsertProject(db: Db, value: NewProject): void {
  db.insert(projects).values(value).onConflictDoNothing().run();
}

export function listProjects(db: Db): ProjectRow[] {
  return db.select().from(projects).orderBy(projects.created_at).all();
}
