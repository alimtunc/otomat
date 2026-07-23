import { lstatSync } from "node:fs";
import { dirname, join } from "node:path";

import { MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { runPendingMigrations } from "../migrate.js";
import { createConsistentBackup } from "./backup.js";
import { DataSafetyError, inspectPathAfterFailure } from "./errors.js";
import { inspectExistingDatabase } from "./existing-database.js";
import { cleanupInterruptedInitializations, initializeDatabase } from "./initialize.js";
import {
  databaseMarkerExists,
  databaseMarkerPath,
  markDatabaseInitialized,
} from "./initialized-marker.js";
import { removeOrphanedRestoreCopies } from "./restore-paths.js";

export async function prepareDatabase(dbPath: string): Promise<void> {
  removeOrphanedRestoreCopies(dbPath);
  cleanupInterruptedInitializations(dbPath);
  const markerPath = databaseMarkerPath(dbPath);
  const markerExists = databaseMarkerExists(markerPath);
  if (lstatSync(dbPath, { throwIfNoEntry: false }) === undefined) {
    if (markerExists) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database file is missing. Otomat did not recreate it.",
      );
    }
    initializeDatabase(dbPath);
    markDatabaseInitialized(dbPath);
    return;
  }

  const databaseInspection = inspectExistingDatabase(dbPath);
  if (!databaseInspection.pending) {
    markDatabaseInitialized(dbPath);
    return;
  }

  const backupPath = await createConsistentBackup(
    dbPath,
    join(dirname(dbPath), MANAGED_BACKUPS_DIRECTORY_NAME),
  );
  try {
    runPendingMigrations(dbPath);
  } catch (error) {
    const failureInspection = inspectPathAfterFailure(dbPath, error);
    if (failureInspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before migration.",
        { backupPath, cause: failureInspection.cause },
      );
    }
    throw new DataSafetyError(
      "migration_failed",
      "Database migration failed. The original data backup is available for restoration.",
      { backupPath, cause: failureInspection.cause },
    );
  }
  markDatabaseInitialized(dbPath);
}
