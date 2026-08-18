import {
  getIssue,
  listIssues,
  listIssueSources,
  type Db,
  type IssueRow,
  type IssueSourceLifecyclePatch,
  type IssueSourceRow,
} from "@otomat/db";
import type { IssueSourceLifecycle, LinearLifecyclePhase, TrackerStateRef } from "@otomat/domain";

import { SYNC_SOURCE } from "./sync.js";

function stateRef(id: string | null, name: string | null): TrackerStateRef | null {
  return id === null || name === null ? null : { id, name };
}

export function sourceLifecycle(row: IssueSourceLifecyclePatch): IssueSourceLifecycle {
  return {
    in_progress: stateRef(row.in_progress_state_id, row.in_progress_state_name),
    done: stateRef(row.done_state_id, row.done_state_name),
  };
}

/** A Linear identifier is `TEAM-123`, so matching its team key keeps a multi-team project on its own workflow. */
function belongsToSource(issue: IssueRow, source: IssueSourceRow): boolean {
  if (issue.source !== SYNC_SOURCE || issue.source_identifier === null) return false;
  return (
    issue.project_id === source.project_id &&
    issue.source_identifier.split("-")[0] === source.external_team_key
  );
}

export function listSourceIssues(db: Db, source: IssueSourceRow): IssueRow[] {
  return listIssues(db, { projectId: source.project_id }).filter((issue) =>
    belongsToSource(issue, source),
  );
}

export function resolveIssueLifecycle(db: Db, issueId: string): IssueSourceLifecycle {
  const resolved: IssueSourceLifecycle = { in_progress: null, done: null };
  const issue = getIssue(db, issueId);
  if (!issue) return resolved;
  for (const source of listIssueSources(db, SYNC_SOURCE, { projectId: issue.project_id })) {
    if (!belongsToSource(issue, source)) continue;
    const lifecycle = sourceLifecycle(source);
    resolved.in_progress ??= lifecycle.in_progress;
    resolved.done ??= lifecycle.done;
  }
  return resolved;
}

export function resolveLifecycleTarget(
  db: Db,
  issueId: string,
  phase: LinearLifecyclePhase,
): TrackerStateRef | null {
  return resolveIssueLifecycle(db, issueId)[phase];
}
