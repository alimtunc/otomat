import type { ExternalIssueSource } from "@otomat/domain";
import { and, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewIssue = typeof issues.$inferInsert;
export type IssueRow = typeof issues.$inferSelect;

export type LocalIssue = Omit<
  NewIssue,
  "source" | "source_external_id" | "source_identifier" | "source_url" | "synced_at"
> & {
  source?: "local";
  source_external_id?: null;
  source_identifier?: null;
  source_url?: null;
  synced_at?: null;
};

export interface MirroredIssue {
  id: string;
  project_id: string;
  source: ExternalIssueSource;
  source_external_id: string;
  source_identifier: string;
  source_url: string;
  title: string;
  body: string | null;
  status: NonNullable<NewIssue["status"]>;
  synced_at: string;
}

export function insertIssue(db: Db, value: LocalIssue): void {
  db.insert(issues).values(value).run();
}

export function getIssueBySourceExternalId(
  db: Db,
  source: ExternalIssueSource,
  sourceExternalId: string,
): IssueRow | undefined {
  return db
    .select()
    .from(issues)
    .where(and(eq(issues.source, source), eq(issues.source_external_id, sourceExternalId)))
    .get();
}

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
