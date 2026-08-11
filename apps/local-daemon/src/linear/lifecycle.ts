import { getIssue, listIssueSources, type Db, type IssueSourceLifecyclePatch } from "@otomat/db";
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
export function resolveLifecycleTarget(
  db: Db,
  issueId: string,
  phase: LinearLifecyclePhase,
): TrackerStateRef | null {
  const issue = getIssue(db, issueId);
  if (!issue || issue.source !== SYNC_SOURCE || issue.source_identifier === null) return null;
  const teamKey = issue.source_identifier.split("-")[0];
  for (const source of listIssueSources(db, SYNC_SOURCE, { projectId: issue.project_id })) {
    if (source.external_team_key !== teamKey) continue;
    const target = sourceLifecycle(source)[phase];
    if (target !== null) return target;
  }
  return null;
}
