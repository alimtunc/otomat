import { afterEach, beforeEach, expect, it } from "vitest";

import {
  findOverlappingIssueSource,
  getIssueSource,
  insertIssueSource,
  listIssueSources,
  updateIssueSourceLifecycle,
  type NewIssueSource,
} from "#db/repositories/issue-sources";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

function source(overrides: Partial<NewIssueSource> = {}): NewIssueSource {
  return {
    id: "s1",
    project_id: "p1",
    source: "linear",
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

it.each([{ external_project_id: "project-1" }, { external_project_name: "Project one" }])(
  "rejects an incomplete project scope",
  (incompleteScope) => {
    // SAFETY: deliberately violates the both-or-neither project scope to prove the insert throws.
    const incomplete = { ...source(), ...incompleteScope } as NewIssueSource;
    expect(() => insertIssueSource(t.client.db, incomplete)).toThrow(
      "issue source project id and name must either both be set or both be empty",
    );
  },
);

it("stores a lifecycle mapping and clears it back to unmapped", () => {
  insertIssueSource(t.client.db, source());
  expect(getIssueSource(t.client.db, "s1")?.done_state_id).toBeNull();

  updateIssueSourceLifecycle(t.client.db, "s1", {
    in_progress_state_id: "s-doing",
    in_progress_state_name: "Doing",
    done_state_id: "s-shipped",
    done_state_name: "Shipped",
  });
  expect(getIssueSource(t.client.db, "s1")).toMatchObject({
    in_progress_state_name: "Doing",
    done_state_id: "s-shipped",
  });

  updateIssueSourceLifecycle(t.client.db, "s1", {
    in_progress_state_id: "s-doing",
    in_progress_state_name: "Doing",
    done_state_id: null,
    done_state_name: null,
  });
  expect(getIssueSource(t.client.db, "s1")?.done_state_name).toBeNull();
});

it("finds mappings whose scopes overlap", () => {
  insertIssueSource(t.client.db, source());

  expect(findOverlappingIssueSource(t.client.db, "linear", "team-uuid", "")?.id).toBe("s1");
  expect(findOverlappingIssueSource(t.client.db, "linear", "team-uuid", "proj-uuid")?.id).toBe(
    "s1",
  );
  expect(findOverlappingIssueSource(t.client.db, "github", "team-uuid", "")).toBeUndefined();
});

it("rejects a duplicate mapping of the same team and project", () => {
  insertIssueSource(t.client.db, source());

  expect(() => insertIssueSource(t.client.db, source({ id: "s2" }))).toThrow(/UNIQUE/);
});

it("allows the same external scope for different providers", () => {
  insertIssueSource(t.client.db, source());
  insertIssueSource(t.client.db, source({ id: "s2", source: "github" }));

  expect(listIssueSources(t.client.db, "linear").map((row) => row.id)).toEqual(["s1"]);
  expect(listIssueSources(t.client.db, "github").map((row) => row.id)).toEqual(["s2"]);
});

it("lists provider mappings in stable order", () => {
  insertIssueSource(t.client.db, source());
  insertIssueSource(t.client.db, source({ id: "s2", external_team_id: "other-team" }));

  expect(listIssueSources(t.client.db, "linear").map((row) => row.id)).toEqual(["s1", "s2"]);
});
