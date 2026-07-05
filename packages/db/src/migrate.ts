import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createClient } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "..", "drizzle");

/** Resolved DB file path: `OTOMAT_DB_PATH` when set, else `.data/otomat.db` under the current working directory. */
export function defaultDbPath(): string {
  return process.env.OTOMAT_DB_PATH ?? resolve(process.cwd(), ".data", "otomat.db");
}

/**
 * Applies all pending Drizzle migrations to the SQLite file at `dbPath`,
 * creating its parent directory if missing. Opens a dedicated connection and
 * closes it in a `finally` before returning; safe to re-run, since only
 * unapplied migrations execute.
 */
export function runMigrations(dbPath: string): void {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const { db, sqlite } = createClient(dbPath);
  try {
    migrate(db, { migrationsFolder });
  } finally {
    sqlite.close();
  }
}
