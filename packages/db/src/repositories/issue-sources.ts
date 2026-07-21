import { and, eq, or } from "drizzle-orm";

import type { Db } from "../client.js";
import { issueSources } from "../schema/index.js";

type IssueSourceInsert = typeof issueSources.$inferInsert;
type ExternalIssueSource = Exclude<NonNullable<IssueSourceInsert["source"]>, "local">;
type IssueSourceInsertBase = Omit<
  IssueSourceInsert,
  "source" | "external_project_id" | "external_project_name"
>;
type IssueSourceProjectScope =
  | { external_project_id?: ""; external_project_name?: "" }
  | { external_project_id: string; external_project_name: string };

export type NewIssueSource = IssueSourceInsertBase &
  IssueSourceProjectScope & {
    source: ExternalIssueSource;
  };
export type IssueSourceRow = typeof issueSources.$inferSelect;

export function insertIssueSource(db: Db, value: NewIssueSource): void {
  const externalProjectId = value.external_project_id ?? "";
  const externalProjectName = value.external_project_name ?? "";
  if ((externalProjectId === "") !== (externalProjectName === "")) {
    throw new Error("issue source project id and name must either both be set or both be empty");
  }
  db.insert(issueSources).values(value).run();
}

export function getIssueSource(db: Db, id: string): IssueSourceRow | undefined {
  return db.select().from(issueSources).where(eq(issueSources.id, id)).get();
}

export function findOverlappingIssueSource(
  db: Db,
  source: ExternalIssueSource,
  externalTeamId: string,
  externalProjectId: string,
): IssueSourceRow | undefined {
  const scopeOverlap =
    externalProjectId === ""
      ? eq(issueSources.external_team_id, externalTeamId)
      : and(
          eq(issueSources.external_team_id, externalTeamId),
          or(
            eq(issueSources.external_project_id, ""),
            eq(issueSources.external_project_id, externalProjectId),
          ),
        );
  return db
    .select()
    .from(issueSources)
    .where(and(eq(issueSources.source, source), scopeOverlap))
    .get();
}

export function listIssueSources(
  db: Db,
  options: { source?: ExternalIssueSource } = {},
): IssueSourceRow[] {
  return db
    .select()
    .from(issueSources)
    .where(options.source ? eq(issueSources.source, options.source) : undefined)
    .orderBy(issueSources.created_at, issueSources.id)
    .all();
}
