import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createClient } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "..", "drizzle");

export function defaultDbPath(): string {
  return process.env.OTOMAT_DB_PATH ?? resolve(process.cwd(), ".data", "otomat.db");
}

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
