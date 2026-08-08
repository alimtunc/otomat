import {
  deleteIssueSource,
  deleteSyncState,
  getIssueSource,
  getProject,
  getSyncState,
  type Db,
  type IssueSourceRow,
  listIssueSources,
} from "@otomat/db";
import {
  issueSourceContractSchema,
  linearSyncStatusSchema,
  type IssueSourceContract,
  type LinearSyncStatusContract,
  type SyncLinearRequest,
} from "@otomat/domain";

import { linearError } from "./errors.js";
import type { LinearSyncRuns } from "./sync-runs.js";
import { SYNC_RESOURCE, SYNC_SOURCE } from "./sync.js";

export function sourceContract(
  db: Db,
  row: Omit<IssueSourceRow, "created_at" | "updated_at">,
): IssueSourceContract {
  const cursor = getSyncState(db, SYNC_SOURCE, SYNC_RESOURCE, row.id);
  return issueSourceContractSchema.parse({
    id: row.id,
    project_id: row.project_id,
    source: row.source,
    external_team_id: row.external_team_id,
    external_team_key: row.external_team_key,
    external_team_name: row.external_team_name,
    external_project_id: row.external_project_id,
    external_project_name: row.external_project_name,
    last_synced_at: cursor?.last_synced_at ?? null,
  });
}

export function listSourceContracts(db: Db, projectId?: string): IssueSourceContract[] {
  return listIssueSources(db, SYNC_SOURCE, { projectId }).map((row) => sourceContract(db, row));
}

export function deleteSourceMapping(db: Db, sourceId: string): void {
  const row = getIssueSource(db, sourceId);
  if (row === undefined || row.source !== SYNC_SOURCE) {
    throw linearError("linear_source_not_found");
  }
  deleteIssueSource(db, sourceId);
  deleteSyncState(db, SYNC_SOURCE, SYNC_RESOURCE, sourceId);
}

export function resolveSyncSources(db: Db, request: SyncLinearRequest): IssueSourceRow[] {
  if (request.source_id === undefined) {
    // A project this daemon does not own must refuse, never quietly sync nothing:
    // the cockpit points at one daemon per host and would read that as success.
    requireProject(db, request.project_id);
    return listIssueSources(db, SYNC_SOURCE, { projectId: request.project_id });
  }
  const row = getIssueSource(db, request.source_id);
  if (row === undefined || row.source !== SYNC_SOURCE) throw linearError("linear_source_not_found");
  return [row];
}

/** One project's Linear freshness: persisted watermarks plus this process's live passes. */
export function projectSyncStatus(
  db: Db,
  runs: LinearSyncRuns,
  projectId: string,
): LinearSyncStatusContract {
  requireProject(db, projectId);
  const sources = listIssueSources(db, SYNC_SOURCE, { projectId });
  const outcome = runs.outcome(projectId);
  return linearSyncStatusSchema.parse({
    project_id: projectId,
    sources: sources.length,
    running: runs.running(sources.map((source) => source.id)),
    last_synced_at: oldestSuccess(db, sources),
    last_result: outcome.result,
    last_error: outcome.error,
  });
}

function requireProject(db: Db, projectId: string | undefined): void {
  if (projectId === undefined) return;
  if (getProject(db, projectId) === undefined) throw linearError("linear_project_not_found");
}

/** A project is only as fresh as its stalest source, and not fresh at all until each has synced. */
function oldestSuccess(db: Db, sources: IssueSourceRow[]): string | null {
  let oldest: string | null = null;
  for (const source of sources) {
    const syncedAt =
      getSyncState(db, SYNC_SOURCE, SYNC_RESOURCE, source.id)?.last_synced_at ?? null;
    if (syncedAt === null) return null;
    if (oldest === null || syncedAt < oldest) oldest = syncedAt;
  }
  return oldest;
}
