import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";

import { seedReviewRun } from "./support/temp-db.js";

const LEGACY_MIGRATIONS = [
  "0000_sticky_hellfire_club",
  "0001_famous_eternals",
  "0002_peaceful_black_bird",
  "0003_wise_dreadnoughts",
] as const;

const LEGACY_JOURNAL = {
  version: "7",
  dialect: "sqlite",
  entries: [
    { idx: 0, version: "6", when: 1781738421212, tag: LEGACY_MIGRATIONS[0], breakpoints: true },
    { idx: 1, version: "6", when: 1781824126183, tag: LEGACY_MIGRATIONS[1], breakpoints: true },
    { idx: 2, version: "6", when: 1782767699748, tag: LEGACY_MIGRATIONS[2], breakpoints: true },
    { idx: 3, version: "6", when: 1783201055217, tag: LEGACY_MIGRATIONS[3], breakpoints: true },
  ],
};

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

it("upgrades a duplicate legacy pull request set through migration 0004", () => {
  const dir = mkdtempSync(join(tmpdir(), "otomat-migration-0004-"));
  const dbPath = join(dir, "otomat.db");
  const legacyMigrations = join(dir, "legacy-migrations");
  const legacyMeta = join(legacyMigrations, "meta");
  mkdirSync(legacyMeta, { recursive: true });
  for (const migration of LEGACY_MIGRATIONS) {
    copyFileSync(
      new URL(`../drizzle/${migration}.sql`, import.meta.url),
      join(legacyMigrations, `${migration}.sql`),
    );
  }
  writeFileSync(join(legacyMeta, "_journal.json"), JSON.stringify(LEGACY_JOURNAL));

  const legacy = createClient(dbPath);
  migrate(legacy.db, { migrationsFolder: legacyMigrations });
  seedReviewRun(legacy.db);
  legacy.sqlite.exec(`
    INSERT INTO pull_requests (id, run_id, title, created_at, updated_at)
    VALUES
      ('older', 'r1', 'Older', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
      ('newer', 'r1', 'Newer', '2026-02-01 00:00:00', '2026-02-01 00:00:00')
  `);
  legacy.sqlite.close();

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  cleanup = () => {
    migrated.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  };

  const rows = migrated.sqlite
    .prepare("SELECT id, publication_status FROM pull_requests WHERE run_id = ? ORDER BY id")
    .all("r1");
  expect(rows).toEqual([{ id: "newer", publication_status: "not_configured" }]);
  expect(() =>
    migrated.sqlite
      .prepare("INSERT INTO pull_requests (id, run_id, title) VALUES (?, ?, ?)")
      .run("duplicate", "r1", "Duplicate"),
  ).toThrow();
});
