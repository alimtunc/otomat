import { eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { repositories } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewRepository = typeof repositories.$inferInsert;
export type RepositoryRow = typeof repositories.$inferSelect;

export function insertRepository(db: Db, value: NewRepository): void {
  db.insert(repositories).values(value).run();
}

export function getRepository(db: Db, id: string): RepositoryRow | undefined {
  return db.select().from(repositories).where(eq(repositories.id, id)).get();
}

/** Refreshes the branch detected at boot without replacing the repository row. */
export function updateRepositoryDefaultBranch(db: Db, id: string, defaultBranch: string): void {
  db.update(repositories)
    .set(touch({ default_branch: defaultBranch }))
    .where(eq(repositories.id, id))
    .run();
}

export function listRepositories(db: Db, options: { projectId?: string } = {}): RepositoryRow[] {
  return db
    .select()
    .from(repositories)
    .where(options.projectId ? eq(repositories.project_id, options.projectId) : undefined)
    .orderBy(repositories.created_at)
    .all();
}
