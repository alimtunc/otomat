import type { WorktreeRecord } from "./types.js";
import type { WorktreeRow } from "./worktrees-store.js";

/** Maps a persisted `worktrees` row onto the record shape the service returns. */
export function toRecord(row: WorktreeRow): WorktreeRecord {
  return {
    id: row.id,
    owner: row.owner_token ?? "",
    repositoryId: row.repository_id,
    path: row.path,
    branch: row.branch,
    headSha: row.head_sha ?? "",
    baseRef: row.base_ref,
    status: row.status,
  };
}
