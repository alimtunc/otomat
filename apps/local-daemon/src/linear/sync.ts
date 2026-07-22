import {
  type Db,
  getIssueBySourceExternalId,
  getSyncState,
  type IssueSourceRow,
  saveSyncState,
  upsertMirroredIssue,
} from "@otomat/db";
import { type IssueSourceSyncResult, type IssueState } from "@otomat/domain";

import type { LinearApiClient, LinearIssue } from "./types.js";

export const SYNC_SOURCE = "linear";
export const SYNC_RESOURCE = "issues";

export const SYNC_OVERLAP_MS = 60_000;

// "running" is never derived from Linear: only an Otomat-launched run may set it.
const LINEAR_ISSUE_STATES = new Map<string, IssueState>([
  ["triage", "backlog"],
  ["backlog", "backlog"],
  ["unstarted", "ready"],
  ["started", "ready"],
  ["completed", "done"],
  ["canceled", "canceled"],
  ["duplicate", "canceled"],
]);

export function issueStateFromLinear(stateType: string): IssueState {
  return LINEAR_ISSUE_STATES.get(stateType) ?? "backlog";
}

interface SyncContext {
  db: Db;
  client: LinearApiClient;
  idFactory: () => string;
  now: () => Date;
  signal: AbortSignal;
}

function watermarkFrom(startedAt: Date, issues: LinearIssue[]): string {
  const latest = issues.reduce((newest, issue) => {
    const updatedAt = Date.parse(issue.updated_at);
    return Number.isNaN(updatedAt) ? newest : Math.max(newest, updatedAt);
  }, 0);
  // Cap the cursor at the pass start so concurrent updates remain eligible next time.
  const ceiling = latest === 0 ? startedAt.getTime() : Math.min(startedAt.getTime(), latest);
  return new Date(ceiling - SYNC_OVERLAP_MS).toISOString();
}

export async function syncIssueSource(
  ctx: SyncContext,
  source: IssueSourceRow,
  apiKey: string,
): Promise<IssueSourceSyncResult> {
  const startedAt = ctx.now();
  const cursor = getSyncState(ctx.db, SYNC_SOURCE, SYNC_RESOURCE, source.id);

  const issues = await ctx.client.issues(
    apiKey,
    {
      team_id: source.external_team_id,
      project_id: source.external_project_id,
      updated_since: cursor?.cursor ?? null,
    },
    ctx.signal,
  );
  ctx.signal.throwIfAborted();

  const syncedAt = ctx.now().toISOString();
  const nextCursor = watermarkFrom(startedAt, issues);
  let imported = 0;
  let updated = 0;

  ctx.db.transaction(
    () => {
      for (const issue of issues) {
        const existing = getIssueBySourceExternalId(ctx.db, SYNC_SOURCE, issue.id);
        upsertMirroredIssue(ctx.db, {
          id: existing?.id ?? ctx.idFactory(),
          project_id: source.project_id,
          source: SYNC_SOURCE,
          source_external_id: issue.id,
          source_identifier: issue.identifier,
          source_url: issue.url,
          title: issue.title,
          body: issue.description,
          status: issueStateFromLinear(issue.state_type),
          synced_at: syncedAt,
          source_updated_at: issue.updated_at,
          source_assignee_name: issue.assignee_name,
          source_priority: issue.priority,
          source_labels: issue.labels,
          source_state_name: issue.state_name,
          source_state_color: issue.state_color,
        });
        if (existing === undefined) imported += 1;
        else updated += 1;
      }

      saveSyncState(ctx.db, {
        id: cursor?.id ?? ctx.idFactory(),
        source: SYNC_SOURCE,
        resource: SYNC_RESOURCE,
        external_id: source.id,
        cursor: nextCursor,
        last_synced_at: syncedAt,
      });
    },
    { behavior: "immediate" },
  );

  return { source_id: source.id, imported, updated, synced_at: syncedAt };
}
