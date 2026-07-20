import { afterEach, beforeEach, expect, it } from "vitest";

import { getSyncState, saveSyncState } from "#db/repositories/sync-state";

import { createTempDb, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-sync-state-");
});

afterEach(() => {
  t.cleanup();
});

it("advances a watermark in place rather than adding a second cursor", () => {
  saveSyncState(t.client.db, {
    id: "c1",
    source: "linear",
    resource: "issues",
    external_id: "s1",
    cursor: "2026-06-18T00:00:00.000Z",
    last_synced_at: "2026-06-18T00:01:00.000Z",
  });
  saveSyncState(t.client.db, {
    id: "c2",
    source: "linear",
    resource: "issues",
    external_id: "s1",
    cursor: "2026-06-19T00:00:00.000Z",
    last_synced_at: "2026-06-19T00:01:00.000Z",
  });

  const rows = t.client.sqlite.prepare("SELECT id, cursor FROM sync_state").all();
  expect(rows).toEqual([{ id: "c1", cursor: "2026-06-19T00:00:00.000Z" }]);
  expect(getSyncState(t.client.db, "linear", "issues", "s1")?.last_synced_at).toBe(
    "2026-06-19T00:01:00.000Z",
  );
});

it("keeps cursors for different scopes apart", () => {
  saveSyncState(t.client.db, {
    id: "c1",
    source: "linear",
    resource: "issues",
    external_id: "s1",
    cursor: "a",
  });
  saveSyncState(t.client.db, {
    id: "c2",
    source: "linear",
    resource: "issues",
    external_id: "s2",
    cursor: "b",
  });

  expect(getSyncState(t.client.db, "linear", "issues", "s1")?.cursor).toBe("a");
  expect(getSyncState(t.client.db, "linear", "issues", "s2")?.cursor).toBe("b");
  expect(getSyncState(t.client.db, "linear", "issues", "missing")).toBeUndefined();
});
