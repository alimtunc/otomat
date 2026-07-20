import { and, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { issueSources } from "../schema/index.js";

export type NewIssueSource = typeof issueSources.$inferInsert;
export type IssueSourceRow = typeof issueSources.$inferSelect;

export function insertIssueSource(db: Db, value: NewIssueSource): void {
  db.insert(issueSources).values(value).run();
}

export function getIssueSource(db: Db, id: string): IssueSourceRow | undefined {
  return db.select().from(issueSources).where(eq(issueSources.id, id)).get();
}

export function findIssueSourceByExternalScope(
  db: Db,
  source: NonNullable<NewIssueSource["source"]>,
  externalTeamId: string,
  externalProjectId: string,
): IssueSourceRow | undefined {
  return db
    .select()
    .from(issueSources)
    .where(
      and(
        eq(issueSources.source, source),
        eq(issueSources.external_team_id, externalTeamId),
        eq(issueSources.external_project_id, externalProjectId),
      ),
    )
    .get();
}

export function listIssueSources(
  db: Db,
  options: { source?: NonNullable<NewIssueSource["source"]> } = {},
): IssueSourceRow[] {
  return db
    .select()
    .from(issueSources)
    .where(options.source ? eq(issueSources.source, options.source) : undefined)
    .orderBy(issueSources.created_at)
    .all();
}
