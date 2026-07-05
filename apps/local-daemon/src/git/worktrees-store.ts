import { schema, type Db } from "@otomat/db";
import { and, desc, eq, sql } from "drizzle-orm";

import type { WorktreeStatus } from "./types.js";

const { worktrees } = schema;

export type WorktreeRow = typeof worktrees.$inferSelect;
export type NewWorktreeRow = typeof worktrees.$inferInsert;

/**
 * Inserts a `worktrees` row. Throws on the `worktrees_owner_active_unique`
 * partial index when an active row already exists for the same `owner_token`.
 */
export function insertWorktree(db: Db, row: NewWorktreeRow): void {
  db.insert(worktrees).values(row).run();
}

export function findActiveByOwner(db: Db, owner: string): WorktreeRow | undefined {
  return db
    .select()
    .from(worktrees)
    .where(and(eq(worktrees.owner_token, owner), eq(worktrees.status, "active")))
    .get();
}

export function findLatestByOwner(db: Db, owner: string): WorktreeRow | undefined {
  return db
    .select()
    .from(worktrees)
    .where(eq(worktrees.owner_token, owner))
    .orderBy(desc(worktrees.created_at))
    .get();
}

export function findActiveByBranch(db: Db, branch: string): WorktreeRow | undefined {
  return db
    .select()
    .from(worktrees)
    .where(and(eq(worktrees.branch, branch), eq(worktrees.status, "active")))
    .get();
}

export function findActiveByPath(db: Db, path: string): WorktreeRow | undefined {
  return db
    .select()
    .from(worktrees)
    .where(and(eq(worktrees.path, path), eq(worktrees.status, "active")))
    .get();
}

export interface ListWorktreesFilter {
  repositoryId?: string;
  status?: WorktreeStatus;
}

export function listWorktreeRows(db: Db, filter: ListWorktreesFilter = {}): WorktreeRow[] {
  const conditions = [];
  if (filter.repositoryId) conditions.push(eq(worktrees.repository_id, filter.repositoryId));
  if (filter.status) conditions.push(eq(worktrees.status, filter.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(worktrees).where(where).orderBy(desc(worktrees.created_at)).all();
}

export interface WorktreeStatusPatch {
  status: WorktreeStatus;
  head_sha?: string;
}

export function updateWorktreeStatus(db: Db, id: string, patch: WorktreeStatusPatch): void {
  db.update(worktrees)
    .set({
      status: patch.status,
      ...(patch.head_sha !== undefined ? { head_sha: patch.head_sha } : {}),
      updated_at: sql`(CURRENT_TIMESTAMP)`,
    })
    .where(eq(worktrees.id, id))
    .run();
}
