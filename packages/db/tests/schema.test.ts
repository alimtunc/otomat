import { afterEach, expect, it } from "vitest";

import { createTempDb, type TempDb } from "./support/temp-db.js";

const EXPECTED_TABLES = [
  "projects",
  "repositories",
  "worktrees",
  "issues",
  "agents",
  "agent_profiles",
  "skills",
  "runs",
  "compete_groups",
  "step_runs",
  "agent_sessions",
  "event_streams",
  "runtime_events",
  "reviews",
  "review_comments",
  "pull_requests",
  "sync_state",
  "issue_sources",
];

let t: TempDb | null = null;

afterEach(() => {
  t?.cleanup();
  t = null;
});

it("migrate creates exactly the expected canonical tables", () => {
  t = createTempDb("otomat-schema-");
  const rows = t.client.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
    )
    .all() as { name: string }[];

  const tableNames = rows.map((row) => row.name).toSorted();
  expect(tableNames).toEqual(EXPECTED_TABLES.toSorted());
});

it("does not create a workflow_revisions table", () => {
  t = createTempDb("otomat-noworkflow-");
  const row = t.client.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE name = 'workflow_revisions'")
    .get();

  expect(row).toBeUndefined();
});
