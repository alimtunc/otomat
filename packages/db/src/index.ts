/**
 * Local-first persistence for Otomat: SQLite (WAL) behind Drizzle and
 * `better-sqlite3`, isolated entirely within this package. Open a connection
 * with `createClient`, run `runMigrations` before first use, and go through the
 * repository functions — the only sanctioned writers for each table.
 * @packageDocumentation
 */
export * as schema from "./schema/index.js";
export * from "./client.js";
export * from "./repositories/index.js";
export { defaultDbPath, runMigrations } from "./migrate.js";
