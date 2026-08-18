import {
  getSyncState,
  listPullRequestsForProject,
  listRepositories,
  readGitHubViewer,
  sqliteToIso,
  type Db,
  type PullRequestRow,
} from "@otomat/db";
import {
  classifyPullRequestInboxGroup,
  type PullRequestInbox,
  type PullRequestInboxEntry,
  type PullRequestInboxSync,
  type PullRequestInboxViewerIdentity,
} from "@otomat/domain";

import { parsePullRequestReference } from "../import/reference.js";
import { indexIssuesByIdentifier, resolveInboxIssue } from "./link.js";
import type { PullRequestSyncPasses } from "./passes.js";
import { SYNC_RESOURCE, SYNC_SOURCE } from "./sync.js";

interface InboxReadContext {
  db: Db;
  passes: PullRequestSyncPasses;
}

function freshness(db: Db, repositoryIds: string[]): string | null {
  const stamps: string[] = [];
  for (const id of repositoryIds) {
    const stamp = getSyncState(db, SYNC_SOURCE, SYNC_RESOURCE, id)?.last_synced_at ?? null;
    if (stamp === null) return null;
    stamps.push(stamp);
  }
  return stamps.toSorted()[0] ?? null;
}

function toEntry(
  row: PullRequestRow,
  viewer: PullRequestInboxViewerIdentity,
  issue: PullRequestInboxEntry["issue"],
): PullRequestInboxEntry | null {
  if (row.number === null || row.url === null) return null;
  const repository = parsePullRequestReference(row.url)?.repository ?? null;
  if (repository === null) return null;
  const group = classifyPullRequestInboxGroup(
    {
      status: row.status,
      author_login: row.author_login,
      review_decision: row.review_decision,
      checks_state: row.checks_state,
      mergeable: row.mergeable,
      requested_reviewers: row.requested_reviewers,
    },
    viewer,
  );
  if (group === null) return null;
  return {
    id: row.id,
    group,
    repository,
    number: row.number,
    title: row.title,
    url: row.url,
    author_login: row.author_login,
    status: row.status,
    provenance: row.provenance,
    review_decision: row.review_decision,
    checks_state: row.checks_state,
    mergeable: row.mergeable,
    head_ref: row.head_ref,
    base_ref: row.base_ref,
    updated_at: row.provider_updated_at ?? sqliteToIso(row.updated_at),
    run_id: row.run_id,
    issue,
    head_fetched: row.head_sha !== null && row.base_sha !== null,
  };
}

function readPullRequestInboxSync(ctx: InboxReadContext, projectId: string): PullRequestInboxSync {
  const repositoryIds = listRepositories(ctx.db, { projectId }).map((repository) => repository.id);
  return {
    running: ctx.passes.running(projectId),
    repositories: repositoryIds.length,
    last_synced_at: freshness(ctx.db, repositoryIds),
    last_error: ctx.passes.outcome(projectId).error,
  };
}

export function readPullRequestInbox(ctx: InboxReadContext, projectId: string): PullRequestInbox {
  const stored = readGitHubViewer(ctx.db);
  const viewer = { login: stored.login, teams: stored.teams ?? [] };
  const issuesByIdentifier = indexIssuesByIdentifier(ctx.db, projectId);
  const entries = listPullRequestsForProject(ctx.db, projectId).flatMap((row) => {
    const entry = toEntry(row, viewer, resolveInboxIssue(ctx.db, row, issuesByIdentifier));
    return entry === null ? [] : [entry];
  });
  return {
    project_id: projectId,
    viewer: { login: stored.login, teams_known: stored.teams !== null },
    sync: readPullRequestInboxSync(ctx, projectId),
    entries,
  };
}
