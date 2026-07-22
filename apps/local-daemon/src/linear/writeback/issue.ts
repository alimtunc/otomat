import { getIssue, type IssueRow, type Db, upsertMirroredIssue } from "@otomat/db";

import type { LinearIssueDetail } from "../client/types.js";
import { linearError } from "../errors.js";
import { issueStateFromLinear } from "../sync.js";
import type { WritableIssue } from "./types.js";

export function requireWritableIssue(db: Db, issueId: string): WritableIssue {
  const issue = getIssue(db, issueId);
  if (!issue) throw linearError("linear_issue_not_found");
  if (issue.source !== "linear" || !issue.source_external_id) {
    throw linearError("linear_issue_not_writable");
  }
  return { issue, linearId: issue.source_external_id };
}

export function refreshMirror(db: Db, issue: IssueRow, detail: LinearIssueDetail, now: Date): void {
  upsertMirroredIssue(db, {
    id: issue.id,
    project_id: issue.project_id,
    source: "linear",
    source_external_id: detail.external_id,
    source_identifier: detail.identifier,
    source_url: detail.url,
    title: detail.title,
    body: detail.description,
    status: issueStateFromLinear(detail.state.type),
    synced_at: now.toISOString(),
    source_updated_at: detail.updated_at,
    source_assignee_name: detail.assignee?.name ?? null,
    source_priority: detail.priority,
    source_labels: detail.labels.map((label) => ({ name: label.name, color: label.color })),
    source_state_name: detail.state.name,
    source_state_color: detail.state.color,
  });
}
