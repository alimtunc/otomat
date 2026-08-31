import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LINEAR_DEFAULT_CONNECTION_ID } from "@otomat/domain";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";

interface JournalEntry {
  idx: number;
  tag: string;
}

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

/** A database migrated to the release just before the connection catalogue landed. */
function databaseBeforeCatalogue(): string {
  const dir = mkdtempSync(join(tmpdir(), "otomat-linear-backfill-"));
  const migrations = join(dir, "migrations");
  mkdirSync(join(migrations, "meta"), { recursive: true });
  // SAFETY: the journal is this package's own build asset; a shape change fails the copy below.
  const journal = JSON.parse(
    readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: JournalEntry[] };
  const catalogueIdx = journal.entries.findIndex(
    (entry) => entry.tag === "0035_linear_connections",
  );
  if (catalogueIdx === -1) throw new Error("0035_linear_connections is missing from the journal");
  const before = journal.entries.slice(0, catalogueIdx);
  for (const entry of before) {
    copyFileSync(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      join(migrations, `${entry.tag}.sql`),
    );
  }
  writeFileSync(
    join(migrations, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries: before }),
  );

  const dbPath = join(dir, "otomat.db");
  const client = createClient(dbPath);
  migrate(client.db, { migrationsFolder: migrations });
  client.sqlite.close();
  cleanup = () => rmSync(dir, { recursive: true, force: true });
  return dbPath;
}

it("keeps the single connection's mappings by naming the default connection", () => {
  const dbPath = databaseBeforeCatalogue();
  const seeded = createClient(dbPath);
  seeded.sqlite.exec(`
    INSERT INTO projects (id, name, root_path) VALUES ('p1', 'Otomat', '/tmp/otomat');
    INSERT INTO issue_sources (
      id, source, project_id, external_team_id, external_team_key, external_team_name,
      in_progress_state_id, in_progress_state_name
    )
    VALUES ('src-1', 'linear', 'p1', 'team-1', 'OTO', 'Otomat', 's-doing', 'Doing')
  `);
  seeded.sqlite.close();

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  const dispose = cleanup;
  cleanup = () => {
    migrated.sqlite.close();
    dispose?.();
  };

  expect(migrated.sqlite.prepare("SELECT id, label FROM linear_connections").all()).toEqual([
    { id: LINEAR_DEFAULT_CONNECTION_ID, label: "Linear" },
  ]);
  expect(
    migrated.sqlite
      .prepare("SELECT connection_id, external_team_key, in_progress_state_name FROM issue_sources")
      .all(),
  ).toEqual([
    {
      connection_id: LINEAR_DEFAULT_CONNECTION_ID,
      external_team_key: "OTO",
      in_progress_state_name: "Doing",
    },
  ]);
});

it("catalogues nothing on an installation that never mapped a source", () => {
  const dbPath = databaseBeforeCatalogue();

  runMigrations(dbPath);
  const migrated = createClient(dbPath);
  const dispose = cleanup;
  cleanup = () => {
    migrated.sqlite.close();
    dispose?.();
  };

  expect(migrated.sqlite.prepare("SELECT id FROM linear_connections").all()).toEqual([]);
});
