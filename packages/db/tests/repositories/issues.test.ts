import { afterEach, beforeEach, expect, it } from "vitest";

import {
  getIssue,
  getIssueBySourceExternalId,
  insertIssue,
  type MirroredIssue,
  upsertMirroredIssue,
} from "#db/repositories/issues";
import { issues } from "#db/schema/issues";
import { createTempDb, seedProject, type TempDb } from "#test-support/temp-db";

const LINEAR_UUID = "0f7d1b5c-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

function mirrored(overrides: Partial<MirroredIssue> = {}): MirroredIssue {
  return {
    id: "i1",
    project_id: "p1",
    source: "linear",
    source_external_id: LINEAR_UUID,
    source_identifier: "OTO-5",
    source_url: "https://linear.app/otomat/issue/OTO-5",
    title: "Foundation",
    body: null,
    status: "backlog",
    synced_at: "2026-06-18T00:00:00.000Z",
    source_updated_at: "2026-06-18T00:00:00.000Z",
    source_assignee_name: "Alim",
    source_priority: 2,
    source_labels: [{ name: "bug", color: "#eb5757" }],
    source_state_name: "Todo",
    source_state_color: "#e2e2e2",
    ...overrides,
  };
}

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-issues-");
  seedProject(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("round-trips an issue with external-mirror columns", () => {
  upsertMirroredIssue(t.client.db, mirrored());

  const issue = getIssue(t.client.db, "i1");
  expect(issue?.source).toBe("linear");
  expect(issue?.source_external_id).toBe(LINEAR_UUID);
  expect(issue?.source_identifier).toBe("OTO-5");
  expect(issue?.source_url).toBe("https://linear.app/otomat/issue/OTO-5");
  expect(issue?.synced_at).toBe("2026-06-18T00:00:00.000Z");
  expect(issue?.source_updated_at).toBe("2026-06-18T00:00:00.000Z");
  expect(issue?.source_assignee_name).toBe("Alim");
  expect(issue?.source_priority).toBe(2);
  expect(issue?.source_labels).toEqual([{ name: "bug", color: "#eb5757" }]);
  expect(issue?.source_state_name).toBe("Todo");
  expect(issue?.source_state_color).toBe("#e2e2e2");
});

it("finds a mirrored issue by its immutable external id", () => {
  upsertMirroredIssue(t.client.db, mirrored());

  expect(getIssueBySourceExternalId(t.client.db, "linear", LINEAR_UUID)).toMatchObject({
    id: "i1",
    source_identifier: "OTO-5",
    source_url: "https://linear.app/otomat/issue/OTO-5",
  });
  expect(getIssueBySourceExternalId(t.client.db, "linear", "unknown")).toBeUndefined();
  expect(getIssueBySourceExternalId(t.client.db, "github", LINEAR_UUID)).toBeUndefined();
});

it("re-syncing the same external issue updates the row instead of duplicating it", () => {
  upsertMirroredIssue(t.client.db, mirrored());
  upsertMirroredIssue(
    t.client.db,
    mirrored({
      id: "i2",
      title: "Foundation, renamed",
      source_identifier: "ENG-9",
      status: "ready",
      synced_at: "2026-06-19T00:00:00.000Z",
      source_assignee_name: "Sam",
      source_priority: 1,
      source_labels: [{ name: "urgent", color: "#f2994a" }],
      source_state_name: "In Progress",
      source_state_color: "#f2c94c",
    }),
  );

  const rows = t.client.sqlite.prepare("SELECT id FROM issues").all();
  expect(rows).toEqual([{ id: "i1" }]);
  const issue = getIssue(t.client.db, "i1");
  expect(issue?.title).toBe("Foundation, renamed");
  expect(issue?.source_identifier).toBe("ENG-9");
  expect(issue?.status).toBe("ready");
  expect(issue?.synced_at).toBe("2026-06-19T00:00:00.000Z");
  expect(issue?.source_assignee_name).toBe("Sam");
  expect(issue?.source_priority).toBe(1);
  expect(issue?.source_labels).toEqual([{ name: "urgent", color: "#f2994a" }]);
  expect(issue?.source_state_name).toBe("In Progress");
  expect(issue?.source_state_color).toBe("#f2c94c");
});

it("rejects a second row mirroring the same external issue", () => {
  upsertMirroredIssue(t.client.db, mirrored());

  expect(() =>
    t.client.db
      .insert(issues)
      .values({
        id: "i2",
        project_id: "p1",
        title: "Duplicate",
        source: "linear",
        source_external_id: LINEAR_UUID,
      })
      .run(),
  ).toThrow(/UNIQUE/);
});

it("allows the same external issue id for different providers", () => {
  upsertMirroredIssue(t.client.db, mirrored());
  upsertMirroredIssue(
    t.client.db,
    mirrored({
      id: "i2",
      source: "github",
      source_identifier: "36",
      source_url: "https://github.com/otomat/issues/36",
    }),
  );

  expect(t.client.sqlite.prepare("SELECT id FROM issues ORDER BY id").all()).toEqual([
    { id: "i1" },
    { id: "i2" },
  ]);
});

it("keeps local issues free of the mirror uniqueness because their external id is null", () => {
  insertIssue(t.client.db, { id: "l1", project_id: "p1", title: "One" });
  insertIssue(t.client.db, { id: "l2", project_id: "p1", title: "Two" });

  expect(getIssue(t.client.db, "l1")?.source).toBe("local");
  expect(getIssue(t.client.db, "l2")?.source).toBe("local");
});
