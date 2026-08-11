import {
  deleteIssueSource,
  deleteSyncState,
  getIssueSource,
  getProject,
  getSyncState,
  type Db,
  type IssueSourceRow,
  listIssueSources,
  updateIssueSourceLifecycle,
} from "@otomat/db";
import {
  issueSourceContractSchema,
  linearSyncStatusSchema,
  type IssueSourceContract,
  type LinearSyncStatusContract,
  type LinearWorkflowState,
  type LinearWorkspaceContract,
  type SyncLinearRequest,
  type UpdateIssueSourceRequest,
} from "@otomat/domain";

import { linearError } from "./errors.js";
import { sourceLifecycle } from "./lifecycle.js";
import type { LinearSyncRuns } from "./sync-runs.js";
import { SYNC_RESOURCE, SYNC_SOURCE } from "./sync.js";

export function sourceContract(db: Db, row: IssueSourceRow): IssueSourceContract {
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
    lifecycle: sourceLifecycle(row),
  });
}

export function listSourceContracts(db: Db, projectId?: string): IssueSourceContract[] {
  return listIssueSources(db, SYNC_SOURCE, { projectId }).map((row) => sourceContract(db, row));
}

export function requireSourceRow(db: Db, sourceId: string): IssueSourceRow {
  const row = getIssueSource(db, sourceId);
  if (row === undefined || row.source !== SYNC_SOURCE) {
    throw linearError("linear_source_not_found");
  }
  return row;
}

export function deleteSourceMapping(db: Db, sourceId: string): void {
  requireSourceRow(db, sourceId);
  deleteIssueSource(db, sourceId);
  deleteSyncState(db, SYNC_SOURCE, SYNC_RESOURCE, sourceId);
}

function requireTeamState(
  states: readonly LinearWorkflowState[],
  stateId: string | null,
): LinearWorkflowState | null {
  if (stateId === null) return null;
  const state = states.find((candidate) => candidate.id === stateId);
  if (state === undefined) throw linearError("linear_source_state_invalid");
  return state;
}

export function updateSourceLifecycle(
  db: Db,
  workspace: LinearWorkspaceContract,
  sourceId: string,
  request: UpdateIssueSourceRequest,
): IssueSourceContract {
  const row = requireSourceRow(db, sourceId);
  const team = workspace.teams.find((candidate) => candidate.id === row.external_team_id);
  if (team === undefined) throw linearError("linear_source_invalid_selection");
  const inProgress = requireTeamState(team.states, request.in_progress_state_id);
  const done = requireTeamState(team.states, request.done_state_id);
  updateIssueSourceLifecycle(db, sourceId, {
    in_progress_state_id: inProgress?.id ?? null,
    in_progress_state_name: inProgress?.name ?? null,
    done_state_id: done?.id ?? null,
    done_state_name: done?.name ?? null,
  });
  return sourceContract(db, requireSourceRow(db, sourceId));
}

export function resolveSyncSources(db: Db, request: SyncLinearRequest): IssueSourceRow[] {
  if (request.source_id === undefined) {
    requireProject(db, request.project_id);
    return listIssueSources(db, SYNC_SOURCE, { projectId: request.project_id });
  }
  return [requireSourceRow(db, request.source_id)];
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
