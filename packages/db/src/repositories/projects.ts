import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { projects } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewProject = typeof projects.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;

/** Idempotent: leaves an existing project untouched. Used for the daemon's default-project bootstrap. */
export function upsertProject(db: Db, value: NewProject): void {
  db.insert(projects).values(value).onConflictDoNothing().run();
}

/** Strict insert for registrations: duplicate id or `root_path` throws (unique index). */
export function insertProject(db: Db, value: NewProject): void {
  db.insert(projects).values(value).run();
}

/** Exact-match lookup; canonical-path dedup beyond string equality is the daemon's job. */
export function getProjectByRootPath(db: Db, rootPath: string): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.root_path, rootPath)).get();
}

/** Re-anchors a project (the bootstrapped workspace) whose root moved between daemon boots. */
export function updateProjectRootPath(db: Db, id: string, rootPath: string): void {
  db.update(projects)
    .set(touch({ root_path: rootPath }))
    .where(eq(projects.id, id))
    .run();
}

export function getProject(db: Db, id: string): ProjectRow | undefined {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

export function listProjects(db: Db): ProjectRow[] {
  return db.select().from(projects).orderBy(projects.created_at).all();
}
