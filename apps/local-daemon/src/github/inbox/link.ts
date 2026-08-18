import { getIssue, listIssues, type Db, type IssueRow, type PullRequestRow } from "@otomat/db";
import type { PullRequestInboxIssue } from "@otomat/domain";

const IDENTIFIER = /\b[A-Z][A-Z0-9]*-\d+\b/g;

function extractIssueIdentifiers(text: string): string[] {
  return [...new Set(text.match(IDENTIFIER) ?? [])];
}

export function indexIssuesByIdentifier(db: Db, projectId: string): Map<string, IssueRow> {
  const index = new Map<string, IssueRow>();
  for (const issue of listIssues(db, { projectId })) {
    if (issue.source_identifier !== null) index.set(issue.source_identifier, issue);
  }
  return index;
}

function toInboxIssue(
  issue: IssueRow,
  evidence: PullRequestInboxIssue["evidence"],
): PullRequestInboxIssue {
  return {
    id: issue.id,
    identifier: issue.source_identifier,
    title: issue.title,
    status: issue.status,
    evidence,
  };
}

/** Durable evidence only: the link the row holds, or exactly one identifier naming a mirrored issue. */
export function resolveInboxIssue(
  db: Db,
  row: PullRequestRow,
  issuesByIdentifier: ReadonlyMap<string, IssueRow>,
): PullRequestInboxIssue | null {
  if (row.issue_id !== null) {
    const attached = getIssue(db, row.issue_id);
    return attached === undefined ? null : toInboxIssue(attached, "attachment");
  }
  const referenced = extractIssueIdentifiers(`${row.title}\n${row.body ?? ""}`).flatMap(
    (identifier) => issuesByIdentifier.get(identifier) ?? [],
  );
  const [only] = referenced;
  return referenced.length === 1 && only !== undefined ? toInboxIssue(only, "reference") : null;
}
