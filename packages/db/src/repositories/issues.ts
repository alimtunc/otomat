import type { ExternalIssueSource, IssueState, SourceLabel } from "@otomat/domain";
import { and, eq, getTableColumns, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { issues } from "../schema/index.js";
import { releasePreparedWorkspace } from "./prepared-workspaces.js";
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
  source_updated_at: string | null;
  source_assignee_name: string | null;
  source_priority: number | null;
  source_labels: SourceLabel[] | null;
  source_state_name: string | null;
  source_state_color: string | null;
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
  db.transaction(() => {
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
          source_updated_at: value.source_updated_at,
          source_assignee_name: value.source_assignee_name,
          source_priority: value.source_priority,
          source_labels: value.source_labels,
          source_state_name: value.source_state_name,
          source_state_color: value.source_state_color,
        }),
      })
      .run();
    if (value.status === "done" || value.status === "canceled") {
      const row = getIssueBySourceExternalId(db, value.source, value.source_external_id);
      if (row) releasePreparedWorkspace(db, row.id);
    }
  });
}

export function getIssue(db: Db, id: string): IssueRow | undefined {
  return db.select().from(issues).where(eq(issues.id, id)).get();
}

/** Persists one issue state; callers validate the edge through `issueMachine` first. */
export function updateIssueStatus(db: Db, id: string, status: IssueState): void {
  db.transaction(() => {
    db.update(issues).set(touch({ status })).where(eq(issues.id, id)).run();
    if (status === "done" || status === "canceled") releasePreparedWorkspace(db, id);
  });
}

/** Re-points a local issue at another project; mirrored issues are refused by the caller. */
export function updateIssueProject(db: Db, id: string, projectId: string): void {
  db.update(issues)
    .set(touch({ project_id: projectId }))
    .where(eq(issues.id, id))
    .run();
}

export function listIssues(
  db: Db,
  options: { projectId?: string; includeBody?: boolean } = {},
): IssueRow[] {
  return db
    .select({
      ...getTableColumns(issues),
      body: options.includeBody === false ? sql<null>`NULL` : issues.body,
    })
    .from(issues)
    .where(options.projectId ? eq(issues.project_id, options.projectId) : undefined)
    .orderBy(issues.created_at)
    .all();
}
