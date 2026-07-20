import { getSyncState, type IssueSourceRow, listIssues } from "@otomat/db";
import { afterEach, beforeEach, expect, it } from "vitest";

import {
  type LinearIssue,
  type LinearIssueQuery,
  SYNC_OVERLAP_MS,
  SYNC_RESOURCE,
  SYNC_SOURCE,
  syncIssueSource,
} from "#linear";

import { setupTestDb, type TestDb } from "../support/db.js";
import { stubLinearApiClient } from "../support/linear.js";

const SOURCE: IssueSourceRow = {
  id: "src-1",
  source: "linear",
  project_id: "p1",
  external_team_id: "team-1",
  external_team_key: "OTO",
  external_team_name: "Otomat",
  external_project_id: "",
  external_project_name: "",
  created_at: "2026-07-20T00:00:00.000Z",
  updated_at: "2026-07-20T00:00:00.000Z",
};

const NOW = new Date("2026-07-20T12:00:00.000Z");

function linearIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: "linear-uuid-1",
    identifier: "OTO-1",
    title: "Mirror me",
    description: "Body",
    url: "https://linear.app/otomat/issue/OTO-1",
    updated_at: "2026-07-20T11:00:00.000Z",
    state_type: "started",
    ...overrides,
  };
}

let t: TestDb;
let ids: number;

function ctx(issues: LinearIssue[], capture?: (query: LinearIssueQuery) => void) {
  return {
    db: t.db,
    client: stubLinearApiClient({
      issues: async (_apiKey, query) => {
        capture?.(query);
        return issues;
      },
    }),
    idFactory: () => `generated-${(ids += 1)}`,
    now: () => NOW,
  };
}

beforeEach(() => {
  t = setupTestDb("otomat-linear-sync-");
  ids = 0;
});

afterEach(() => {
  t.cleanup();
});

it("imports issues on the first pass and records a watermark", async () => {
  const result = await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");

  expect(result).toMatchObject({ source_id: "src-1", imported: 1, updated: 0 });
  const mirrored = listIssues(t.db).find((issue) => issue.source === "linear");
  expect(mirrored).toMatchObject({
    project_id: "p1",
    title: "Mirror me",
    body: "Body",
    source_external_id: "linear-uuid-1",
    source_identifier: "OTO-1",
    source_url: "https://linear.app/otomat/issue/OTO-1",
    status: "running",
  });
  expect(mirrored?.synced_at).toBe(NOW.toISOString());
});

it("rewinds the stored watermark by the overlap window", async () => {
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");

  const cursor = getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, "src-1");
  // The newest issue predates the run, so the ceiling is that issue's timestamp.
  expect(cursor?.cursor).toBe(
    new Date(Date.parse("2026-07-20T11:00:00.000Z") - SYNC_OVERLAP_MS).toISOString(),
  );
  expect(cursor?.last_synced_at).toBe(NOW.toISOString());
});

it("never advances the watermark past the start of the pass", async () => {
  // An issue edited mid-pass reports a timestamp after the run began and may have
  // been missed, so the run's own start bounds the watermark.
  await syncIssueSource(
    ctx([linearIssue({ updated_at: "2026-07-20T13:00:00.000Z" })]),
    SOURCE,
    "key",
  );

  const cursor = getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, "src-1");
  expect(cursor?.cursor).toBe(new Date(NOW.getTime() - SYNC_OVERLAP_MS).toISOString());
});

it("re-syncing the same issue updates the row and never duplicates it", async () => {
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");
  const result = await syncIssueSource(
    ctx([linearIssue({ title: "Renamed", identifier: "ENG-7", state_type: "completed" })]),
    SOURCE,
    "key",
  );

  expect(result).toMatchObject({ imported: 0, updated: 1 });
  const mirrored = listIssues(t.db).filter((issue) => issue.source === "linear");
  expect(mirrored).toHaveLength(1);
  expect(mirrored[0]).toMatchObject({
    title: "Renamed",
    source_identifier: "ENG-7",
    source_external_id: "linear-uuid-1",
    status: "done",
  });
});

it("sends the stored watermark as the next pass's lower bound", async () => {
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");
  const stored = getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, "src-1")?.cursor;

  let seen: LinearIssueQuery | null = null;
  await syncIssueSource(
    ctx([], (query) => {
      seen = query;
    }),
    SOURCE,
    "key",
  );

  expect(seen).toEqual({ team_id: "team-1", project_id: "", updated_since: stored });
});

it("keeps the previous cursor when the pass fails", async () => {
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");
  const before = getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, "src-1")?.cursor;

  const failing = {
    db: t.db,
    client: stubLinearApiClient({
      issues: async () => {
        throw new Error("network down");
      },
    }),
    idFactory: () => "unused",
    now: () => NOW,
  };
  await expect(syncIssueSource(failing, SOURCE, "key")).rejects.toThrow();

  expect(getSyncState(t.db, SYNC_SOURCE, SYNC_RESOURCE, "src-1")?.cursor).toBe(before);
  expect(listIssues(t.db).filter((issue) => issue.source === "linear")).toHaveLength(1);
});

it("keeps a single cursor row across repeated passes", async () => {
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");
  await syncIssueSource(ctx([linearIssue()]), SOURCE, "key");

  const rows = t.client.sqlite.prepare("SELECT id FROM sync_state").all();
  expect(rows).toHaveLength(1);
});
