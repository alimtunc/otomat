import {
  getIssue,
  getRepository,
  listIssues,
  type Db,
  type IssueRow,
  type PullRequestRow,
} from "@otomat/db";
import {
  findIssueReferences,
  type IssueReference,
  type PullRequestIssueLink,
} from "@otomat/domain";

/** Keyed on the lowercased identifier, because a branch lowercases what a tracker uppercases. */
export function indexIssuesByIdentifier(db: Db, projectId: string): Map<string, IssueRow> {
  const index = new Map<string, IssueRow>();
  for (const issue of listIssues(db, { projectId })) {
    if (issue.source_identifier !== null) {
      index.set(issue.source_identifier.toLowerCase(), issue);
    }
  }
  return index;
}

function toIssueLink(
  issue: IssueRow,
  evidence: PullRequestIssueLink["evidence"],
): PullRequestIssueLink {
  return {
    id: issue.id,
    identifier: issue.source_identifier,
    title: issue.title,
    status: issue.status,
    evidence,
  };
}

/** Only a branch is read case-insensitively: prose spells an identifier as the tracker does, and reading `oto-118` in a sentence would make a row naming one issue read as naming two. */
function mirroredIssue(
  reference: IssueReference,
  issuesByIdentifier: ReadonlyMap<string, IssueRow>,
): IssueRow | undefined {
  const issue = issuesByIdentifier.get(reference.identifier.toLowerCase());
  if (issue === undefined) return undefined;
  const spelledAsTracked = issue.source_identifier === reference.identifier;
  return reference.surface === "branch" || spelledAsTracked ? issue : undefined;
}

function soleMirroredIssue(
  references: readonly IssueReference[],
  issuesByIdentifier: ReadonlyMap<string, IssueRow>,
): PullRequestIssueLink | null {
  const named = new Map<string, IssueRow>();
  for (const reference of references) {
    const issue = mirroredIssue(reference, issuesByIdentifier);
    if (issue !== undefined) named.set(issue.id, issue);
  }
  const [issue] = named.values();
  return named.size === 1 && issue !== undefined ? toIssueLink(issue, "reference") : null;
}

/** Durable evidence only: the link the row holds, or exactly one mirrored issue named as a value on the surfaces the issue card reads too. */
export function resolvePullRequestIssue(
  db: Db,
  row: PullRequestRow,
  issuesByIdentifier: ReadonlyMap<string, IssueRow>,
): PullRequestIssueLink | null {
  if (row.issue_id !== null) {
    const attached = getIssue(db, row.issue_id);
    return attached === undefined ? null : toIssueLink(attached, "attachment");
  }
  const named = findIssueReferences({ title: row.title, body: row.body, branch: row.head_ref });
  // The branch is weighed only when the title and the body name no mirrored issue, so reading it cannot unlink what they already resolved.
  return (
    soleMirroredIssue(
      named.filter((reference) => reference.surface !== "branch"),
      issuesByIdentifier,
    ) ??
    soleMirroredIssue(
      named.filter((reference) => reference.surface === "branch"),
      issuesByIdentifier,
    )
  );
}

/** The same verdict for one row, for a surface that reads a single pull request rather than a project. */
export function pullRequestIssue(db: Db, row: PullRequestRow): PullRequestIssueLink | null {
  const project =
    row.repository_id === null ? undefined : getRepository(db, row.repository_id)?.project_id;
  const index =
    project === undefined ? new Map<string, IssueRow>() : indexIssuesByIdentifier(db, project);
  return resolvePullRequestIssue(db, row, index);
}
