import type { ExternalIssueSource } from "@otomat/domain";
import { and, eq, or } from "drizzle-orm";

import type { Db } from "../client.js";
import { issueSources } from "../schema/index.js";
import { touch } from "./touch.js";

type IssueSourceInsert = typeof issueSources.$inferInsert;
type IssueSourceInsertBase = Omit<
  IssueSourceInsert,
  "external_project_id" | "external_project_name"
>;
type IssueSourceProjectScope =
  | { external_project_id?: ""; external_project_name?: "" }
  | { external_project_id: string; external_project_name: string };

export type NewIssueSource = IssueSourceInsertBase & IssueSourceProjectScope;
export type IssueSourceRow = typeof issueSources.$inferSelect;
export type IssueSourceLifecyclePatch = Pick<
  IssueSourceRow,
  "in_progress_state_id" | "in_progress_state_name" | "done_state_id" | "done_state_name"
>;

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
  source: ExternalIssueSource,
  options: { projectId?: string } = {},
): IssueSourceRow[] {
  const scope = options.projectId
    ? and(eq(issueSources.source, source), eq(issueSources.project_id, options.projectId))
    : eq(issueSources.source, source);
  return db
    .select()
    .from(issueSources)
    .where(scope)
    .orderBy(issueSources.created_at, issueSources.id)
    .all();
}

export function updateIssueSourceLifecycle(
  db: Db,
  id: string,
  patch: IssueSourceLifecyclePatch,
): void {
  db.update(issueSources).set(touch(patch)).where(eq(issueSources.id, id)).run();
}

export function deleteIssueSource(db: Db, id: string): void {
  db.delete(issueSources).where(eq(issueSources.id, id)).run();
}
