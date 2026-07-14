import { readFileSync } from "node:fs";

import { afterEach, expect, it } from "vitest";

import { createTempDb, seedReviewRun, type TempDb } from "./support/temp-db.js";

let t: TempDb | null = null;

afterEach(() => {
  t?.cleanup();
  t = null;
});

it("deduplicates legacy pull requests before enforcing one row per run", () => {
  t = createTempDb("otomat-migration-0004-");
  seedReviewRun(t.client.db);
  t.client.sqlite.exec("DROP INDEX pull_requests_run_id_unique");
  t.client.sqlite.exec(`
    INSERT INTO pull_requests (id, run_id, title, created_at, updated_at)
    VALUES
      ('older', 'r1', 'Older', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
      ('newer', 'r1', 'Newer', '2026-02-01 00:00:00', '2026-02-01 00:00:00')
  `);

  const migration = readFileSync(
    new URL("../drizzle/0004_dear_karma.sql", import.meta.url),
    "utf8",
  );
  const deduplication = migration
    .split("--> statement-breakpoint")
    .find((statement) => statement.includes("DELETE FROM `pull_requests`"));
  if (!deduplication) throw new Error("migration 0004 must deduplicate legacy pull requests");

  t.client.sqlite.exec(deduplication);
  t.client.sqlite.exec(
    "CREATE UNIQUE INDEX `pull_requests_run_id_unique` ON `pull_requests` (`run_id`)",
  );

  const rows = t.client.sqlite
    .prepare("SELECT id FROM pull_requests WHERE run_id = ? ORDER BY id")
    .all("r1") as { id: string }[];
  expect(rows).toEqual([{ id: "newer" }]);
  expect(() =>
    t?.client.sqlite
      .prepare("INSERT INTO pull_requests (id, run_id, title) VALUES (?, ?, ?)")
      .run("duplicate", "r1", "Duplicate"),
  ).toThrow();
});
