import { listLivePullRequests, type Db, type PullRequestRow } from "@otomat/db";

import type { PullRequestImportService } from "./import/service.js";
import type { PullRequestPublicationService } from "./publication/types.js";

export interface PullRequestRefreshConfig {
  db: Db;
  publisher: PullRequestPublicationService;
  imports: PullRequestImportService;
}

/** An adopted pull request has no run of its own, so the import service is what re-reads it. */
async function refreshOne(config: PullRequestRefreshConfig, row: PullRequestRow): Promise<void> {
  if (row.run_id === null) {
    await config.imports.refresh(row.id);
  } else {
    await config.publisher.get(row.run_id);
  }
}

/** A row that cannot be read stays open, so the next pass tries it again instead of losing the merge. */
export async function refreshTrackedPullRequests(
  config: PullRequestRefreshConfig,
): Promise<number> {
  let refreshed = 0;
  for (const row of listLivePullRequests(config.db)) {
    try {
      await refreshOne(config, row);
      refreshed += 1;
    } catch (error) {
      console.error(`[otomat] pull request ${row.id} could not be refreshed`, error);
    }
  }
  return refreshed;
}
