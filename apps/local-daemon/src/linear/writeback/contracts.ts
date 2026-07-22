import type { LinearDraftRow, LinearWriteRow } from "@otomat/db";
import type { LinearIssueDraft, LinearIssueSnapshot, LinearWriteContract } from "@otomat/domain";

import type { LinearIssueDetail } from "../client/types.js";

function sqliteToIso(timestamp: string): string {
  return timestamp.includes("T") ? timestamp : `${timestamp.replace(" ", "T")}Z`;
}

export function snapshotToContract(detail: LinearIssueDetail): LinearIssueSnapshot {
  return {
    title: detail.title,
    description: detail.description,
    priority: detail.priority,
    assignee_id: detail.assignee?.id ?? null,
    label_ids: detail.labels.map((label) => label.id),
    external_id: detail.external_id,
    identifier: detail.identifier,
    url: detail.url,
    updated_at: detail.updated_at,
    assignee: detail.assignee,
    labels: detail.labels,
    state: detail.state,
  };
}

export function draftToContract(row: LinearDraftRow): LinearIssueDraft {
  return {
    id: row.id,
    issue_id: row.issue_id,
    base_updated_at: row.base_updated_at,
    title: row.title,
    description: row.description,
    priority: row.priority,
    assignee_id: row.assignee_id,
    label_ids: row.label_ids,
    updated_at: sqliteToIso(row.updated_at),
  };
}

export function writeToContract(row: LinearWriteRow): LinearWriteContract {
  return {
    id: row.id,
    issue_id: row.issue_id,
    run_id: row.run_id,
    kind: row.kind,
    status: row.status,
    idempotency_key: row.idempotency_key,
    detail: row.detail,
    remote_id: row.remote_id,
    error_code: row.error_code,
    error_message: row.error_message,
    created_at: sqliteToIso(row.created_at),
    updated_at: sqliteToIso(row.updated_at),
  };
}
