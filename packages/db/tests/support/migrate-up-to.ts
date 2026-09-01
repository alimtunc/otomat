import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/** Stages the schema as it stood the migration before `tag`, so a data migration can be exercised on real prior rows. */
export function migrateUpToExcluding(dir: string, dbPath: string, tag: string, seed: string): void {
  const journal: { entries: JournalEntry[] } = JSON.parse(
    readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  );
  const target = journal.entries.find((entry) => entry.tag === tag);
  if (!target) throw new Error(`migration ${tag} is not in the journal`);
  const entries = journal.entries.filter((entry) => entry.idx < target.idx);

  const folder = join(dir, `before-${tag}`);
  const meta = join(folder, "meta");
  mkdirSync(meta, { recursive: true });
  for (const entry of entries) {
    copyFileSync(
      new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url),
      join(folder, `${entry.tag}.sql`),
    );
  }
  writeFileSync(
    join(meta, "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries }),
  );

  const prior = createClient(dbPath);
  migrate(prior.db, { migrationsFolder: folder });
  prior.sqlite.exec(seed);
  prior.sqlite.close();
}

export function upgradeFrom(prefix: string, tag: string, seed: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const dbPath = join(dir, "otomat.db");
  migrateUpToExcluding(dir, dbPath, tag, seed);
  runMigrations(dbPath);
  const client = createClient(dbPath);
  return {
    sqlite: client.sqlite,
    cleanup: () => {
      client.sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
