/**
 * Local-first persistence for Otomat: SQLite (WAL) behind Drizzle and
 * `better-sqlite3`, isolated entirely within this package. Open a connection
 * with `createClient`, run `prepareDatabase` at startup, and go through the
 * repository functions — the only sanctioned writers for each table.
 * `runMigrations` is a low-level primitive reserved for controlled initialization
 * and test fixtures; it does not perform safety preflight or backup.
 * @packageDocumentation
 */
export * as schema from "./schema/index.js";
export type { WorktreeStatus } from "./schema/index.js";
export * from "./client.js";
export * from "./data-safety/index.js";
export * from "./repositories/index.js";
export { defaultDbPath, runMigrations } from "./migrate.js";
