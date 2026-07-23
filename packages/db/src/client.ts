import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema/index.js";

export interface DbClient {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
}

export interface CreateClientOptions {
  readonly?: boolean;
  fileMustExist?: boolean;
}

function sqliteInitializationCleanupFailure(operation: unknown, cleanup: unknown): Error {
  return new Error("SQLite initialization failed and its handle could not be closed.", {
    cause: new AggregateError(
      [operation, cleanup],
      "SQLite initialization and handle cleanup both failed.",
    ),
  });
}

/**
 * The only place `better-sqlite3` is constructed. WAL mode matches a single
 * local writer with concurrent readers; foreign keys are enforced.
 */
export function createClient(dbPath: string, options: CreateClientOptions = {}): DbClient {
  const sqlite = new Database(dbPath, options);
  try {
    if (options.readonly !== true) sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    return { db, sqlite };
  } catch (error) {
    try {
      sqlite.close();
    } catch (closeError) {
      throw sqliteInitializationCleanupFailure(error, closeError);
    }
    throw error;
  }
}

export type Db = DbClient["db"];
