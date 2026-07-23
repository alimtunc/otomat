import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createClient } from "./client.js";
import { collectCleanupFailure, throwCollectedFailures } from "./data-safety/errors.js";
import { migrationsFolder } from "./migrations-folder.js";

/** Resolved DB file path: `OTOMAT_DB_PATH` when set, else `.data/otomat.db` under the current working directory. */
export function defaultDbPath(): string {
  return process.env.OTOMAT_DB_PATH ?? resolve(process.cwd(), ".data", "otomat.db");
}

function applyMigrations(dbPath: string, fileMustExist: boolean): void {
  const { db, sqlite } = createClient(dbPath, { fileMustExist });
  const failures: unknown[] = [];
  try {
    migrate(db, { migrationsFolder });
  } catch (error) {
    failures.push(error);
  }
  collectCleanupFailure(failures, () => sqlite.close());
  throwCollectedFailures(failures, "Database migration and handle cleanup both failed.");
}

export function runMigrations(dbPath: string): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  applyMigrations(dbPath, false);
}

export function runPendingMigrations(dbPath: string): void {
  applyMigrations(dbPath, true);
}
