import {
  deleteIssueSource,
  deleteSyncState,
  getIssueSource,
  getSyncState,
  type Db,
  type IssueSourceRow,
  listIssueSources,
} from "@otomat/db";
import {
  issueSourceContractSchema,
  type IssueSourceContract,
  type SyncLinearRequest,
} from "@otomat/domain";

import { linearError } from "./errors.js";
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
    return listIssueSources(db, SYNC_SOURCE, { projectId: request.project_id });
  }
  const row = getIssueSource(db, request.source_id);
  if (row === undefined || row.source !== SYNC_SOURCE) throw linearError("linear_source_not_found");
  return [row];
}
