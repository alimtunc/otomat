import type Database from "better-sqlite3";

import { DataSafetyError, type DataSafetyErrorCode } from "./errors.js";

export function assertDatabaseIntegrity(
  sqlite: Database.Database,
  code: Extract<DataSafetyErrorCode, "database_corrupt" | "invalid_backup" | "restore_failed">,
  label: string,
): void {
  const check = sqlite.pragma("quick_check", { simple: true });
  if (check === "ok") return;
  const message = `${label} failed SQLite integrity validation.`;
  if (code === "database_corrupt") throw new DataSafetyError("database_corrupt", message);
  if (code === "invalid_backup") throw new DataSafetyError("invalid_backup", message);
  throw new DataSafetyError("restore_failed", message);
}
