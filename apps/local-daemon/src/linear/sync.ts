import {
  type Db,
  getIssueBySourceExternalId,
  getSyncState,
  type IssueSourceRow,
  saveSyncState,
  upsertMirroredIssue,
} from "@otomat/db";
import { type IssueSourceSyncResult, issueStateFromLinear } from "@otomat/domain";

import type { LinearApiClient, LinearIssue } from "./types.js";

export const SYNC_SOURCE = "linear";
export const SYNC_RESOURCE = "issues";

/**
 * Rewind applied to every stored watermark. Linear orders `updatedAt` newest
 * first over a mutable field, so an issue edited mid-run can land on a page that
 * was already consumed; re-reading a short window on the next sync recovers it.
 */
export const SYNC_OVERLAP_MS = 60_000;

export interface SyncContext {
  db: Db;
  client: LinearApiClient;
  idFactory: () => string;
  now: () => Date;
}

function watermarkFrom(startedAt: Date, issues: LinearIssue[]): string {
  const latest = issues.reduce((newest, issue) => {
    const updatedAt = Date.parse(issue.updated_at);
    return Number.isNaN(updatedAt) ? newest : Math.max(newest, updatedAt);
  }, 0);
  // An issue updated while paging carries a timestamp past the start of the run
  // and was never guaranteed to be seen, so the run's own start is the ceiling.
  const ceiling = latest === 0 ? startedAt.getTime() : Math.min(startedAt.getTime(), latest);
  return new Date(ceiling - SYNC_OVERLAP_MS).toISOString();
}

/**
 * Mirrors one source into SQLite. The rows and the advanced watermark land in a
 * single immediate transaction, so a failed pass leaves the previous cursor in
 * place and the next sync re-reads the same window instead of skipping it.
 */
export async function syncIssueSource(
  ctx: SyncContext,
  source: IssueSourceRow,
  apiKey: string,
): Promise<IssueSourceSyncResult> {
  const startedAt = ctx.now();
  const cursor = getSyncState(ctx.db, SYNC_SOURCE, SYNC_RESOURCE, source.id);

  const issues = await ctx.client.issues(apiKey, {
    team_id: source.external_team_id,
    project_id: source.external_project_id,
    updated_since: cursor?.cursor ?? null,
  });

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
