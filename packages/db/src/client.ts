import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema/index.js";

export interface DbClient {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
}

/**
 * The only place `better-sqlite3` is constructed. WAL mode matches a single
 * local writer with concurrent readers; foreign keys are enforced.
 */
export function createClient(dbPath: string): DbClient {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export type Db = DbClient["db"];
