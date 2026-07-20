import { and, eq } from "drizzle-orm";

import type { Db } from "../client.js";
import { syncState } from "../schema/index.js";
import { touch } from "./touch.js";

export type NewSyncState = typeof syncState.$inferInsert;
export type SyncStateRow = typeof syncState.$inferSelect;

export function getSyncState(
  db: Db,
  source: string,
  resource: string,
  externalId: string,
): SyncStateRow | undefined {
  return db
    .select()
    .from(syncState)
    .where(
      and(
        eq(syncState.source, source),
        eq(syncState.resource, resource),
        eq(syncState.external_id, externalId),
      ),
    )
    .get();
}

/**
 * Single sanctioned writer for sync cursors. `(source, resource, external_id)`
 * is the conflict target, so the watermark advances in place and a second
 * cursor for the same scope cannot exist; `id` only applies to a new row.
 */
export function saveSyncState(db: Db, value: NewSyncState): void {
  db.insert(syncState)
    .values(value)
    .onConflictDoUpdate({
      target: [syncState.source, syncState.resource, syncState.external_id],
      set: touch({ cursor: value.cursor ?? null, last_synced_at: value.last_synced_at ?? null }),
    })
    .run();
}
