import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";

const EXPECTED_TABLES = [
  "projects",
  "repositories",
  "worktrees",
  "issues",
  "agents",
  "runs",
  "step_runs",
  "agent_sessions",
  "runtime_events",
  "reviews",
  "review_comments",
  "pull_requests",
  "sync_state",
];

let dbPath = "";

afterEach(() => {
  if (dbPath) {
    for (const suffix of ["", "-shm", "-wal"]) {
      rmSync(`${dbPath}${suffix}`, { force: true });
    }
    dbPath = "";
  }
});

it("migrate creates exactly the expected canonical tables", () => {
  dbPath = join(tmpdir(), `otomat-schema-${process.pid}-${process.hrtime.bigint()}.db`);
  runMigrations(dbPath);

  const { sqlite } = createClient(dbPath);
  const rows = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
    )
    .all() as { name: string }[];
  sqlite.close();

  const tableNames = rows.map((row) => row.name).toSorted();
  expect(tableNames).toEqual(EXPECTED_TABLES.toSorted());
});

it("does not create a workflow_revisions table", () => {
  dbPath = join(tmpdir(), `otomat-noworkflow-${process.pid}-${process.hrtime.bigint()}.db`);
  runMigrations(dbPath);

  const { sqlite } = createClient(dbPath);
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE name = 'workflow_revisions'")
    .get();
  sqlite.close();

  expect(row).toBeUndefined();
});
