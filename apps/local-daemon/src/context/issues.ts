import type { IssueRow } from "@otomat/db";
import { CONTEXT_ISSUE_BODY_MAX_LENGTH, type ContextIssue } from "@otomat/domain";

/** The mirrored columns a snapshot reads, so a launch can snapshot the issue it is about to insert. */
export type ContextIssueRow = Pick<
  IssueRow,
  | "id"
  | "title"
  | "body"
  | "status"
  | "source"
  | "source_identifier"
  | "source_state_name"
  | "source_labels"
  | "source_assignee_name"
  | "source_priority"
>;

export function issueContext(row: ContextIssueRow): ContextIssue {
  const body = row.body ?? null;
  const truncated = body !== null && body.length > CONTEXT_ISSUE_BODY_MAX_LENGTH;
  return {
    id: row.id,
    identifier: row.source_identifier,
    title: row.title,
    body: truncated ? body.slice(0, CONTEXT_ISSUE_BODY_MAX_LENGTH) : body,
    body_truncated: truncated,
    status: row.status,
    source: row.source,
    source_state_name: row.source_state_name,
    labels: (row.source_labels ?? []).map((label) => label.name),
    assignee: row.source_assignee_name,
    priority: row.source_priority,
  };
}
