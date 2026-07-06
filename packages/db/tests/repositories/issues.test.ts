import { afterEach, beforeEach, expect, it } from "vitest";

import { getIssue, insertIssue } from "#db/repositories/issues";

import { createTempDb, seedProject, type TempDb } from "../support/temp-db.js";

let t: TempDb;

beforeEach(() => {
  t = createTempDb("otomat-issues-");
});

afterEach(() => {
  t.cleanup();
});

it("round-trips an issue with external-mirror columns", () => {
  seedProject(t.client.db);
  insertIssue(t.client.db, {
    id: "i1",
    project_id: "p1",
    title: "Foundation",
    body: null,
    status: "backlog",
    source: "linear",
    source_external_id: "OTO-5",
    synced_at: "2026-06-18T00:00:00.000Z",
  });

  const issue = getIssue(t.client.db, "i1");
  expect(issue?.source).toBe("linear");
  expect(issue?.source_external_id).toBe("OTO-5");
  expect(issue?.synced_at).toBe("2026-06-18T00:00:00.000Z");
});
