import { afterEach, beforeEach, expect, it } from "vitest";

import {
  findIssueSourceByExternalScope,
  getIssueSource,
  insertIssueSource,
  listIssueSources,
  type NewIssueSource,
} from "#db/repositories/issue-sources";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

function source(overrides: Partial<NewIssueSource> = {}): NewIssueSource {
  return {
    id: "s1",
    source: "linear",
    project_id: "p1",
    external_team_id: "team-uuid",
    external_team_key: "OTO",
    external_team_name: "Otomat",
    ...overrides,
  };
}

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-issue-sources-");
  seedProject(t.client.db);
});

afterEach(() => {
  t.cleanup();
});

it("defaults a whole-team mapping to empty external project columns", () => {
  insertIssueSource(t.client.db, source());

  const row = getIssueSource(t.client.db, "s1");
  expect(row?.external_project_id).toBe("");
  expect(row?.external_project_name).toBe("");
});

it("finds a mapping by its external scope", () => {
  insertIssueSource(t.client.db, source());
  insertIssueSource(
    t.client.db,
    source({ id: "s2", external_project_id: "proj-uuid", external_project_name: "V1" }),
  );

  expect(findIssueSourceByExternalScope(t.client.db, "linear", "team-uuid", "")?.id).toBe("s1");
  expect(findIssueSourceByExternalScope(t.client.db, "linear", "team-uuid", "proj-uuid")?.id).toBe(
    "s2",
  );
  expect(findIssueSourceByExternalScope(t.client.db, "linear", "other", "")).toBeUndefined();
});

it("rejects a duplicate mapping of the same team and project", () => {
  insertIssueSource(t.client.db, source());

  expect(() => insertIssueSource(t.client.db, source({ id: "s2" }))).toThrow(/UNIQUE/);
});

it("lists mappings filtered by source", () => {
  insertIssueSource(t.client.db, source());
  insertIssueSource(t.client.db, source({ id: "s2", source: "github" }));

  expect(listIssueSources(t.client.db, { source: "linear" }).map((row) => row.id)).toEqual(["s1"]);
  expect(listIssueSources(t.client.db)).toHaveLength(2);
});
