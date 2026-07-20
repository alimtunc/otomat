import { and, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewIssue = typeof issues.$inferInsert;
export type IssueRow = typeof issues.$inferSelect;

/** The mirrored fields an external tracker owns; local columns are never overwritten by a sync. */
export interface MirroredIssue {
  id: string;
  project_id: string;
  source: NonNullable<NewIssue["source"]>;
  source_external_id: string;
  source_identifier: string;
  source_url: string;
  title: string;
  body: string | null;
  status: NonNullable<NewIssue["status"]>;
  synced_at: string;
}

export function insertIssue(db: Db, value: NewIssue): void {
  db.insert(issues).values(value).run();
}

export function getIssueBySourceExternalId(
  db: Db,
  source: NonNullable<NewIssue["source"]>,
  sourceExternalId: string,
): IssueRow | undefined {
  return db
    .select()
    .from(issues)
    .where(and(eq(issues.source, source), eq(issues.source_external_id, sourceExternalId)))
    .get();
}

/**
 * Single sanctioned writer for mirrored issues. The `(source, source_external_id)`
 * unique index is the conflict target, so a re-sync updates the existing row
 * instead of duplicating it, and `id` is only used when the row is new.
 */
export function upsertMirroredIssue(db: Db, value: MirroredIssue): void {
  db.insert(issues)
    .values(value)
    .onConflictDoUpdate({
      target: [issues.source, issues.source_external_id],
      set: touch({
        project_id: value.project_id,
        title: value.title,
        body: value.body,
        status: value.status,
        source_identifier: value.source_identifier,
        source_url: value.source_url,
        synced_at: value.synced_at,
      }),
    })
    .run();
}

export function getIssue(db: Db, id: string): IssueRow | undefined {
  return db.select().from(issues).where(eq(issues.id, id)).get();
}

export function listIssues(db: Db, options: { projectId?: string } = {}): IssueRow[] {
  return db
    .select()
    .from(issues)
    .where(options.projectId ? eq(issues.project_id, options.projectId) : undefined)
    .orderBy(issues.created_at)
    .all();
}
