import { randomUUID } from "node:crypto";
import { lstatSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { DATABASE_INITIALIZED_MARKER_SUFFIX, MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { createClient } from "../client.js";
import { runPendingMigrations } from "../migrate.js";
import { isUuidV4ArtifactName } from "./artifact-names.js";
import { createConsistentBackup } from "./backup.js";
import { publishPathDurably } from "./durable-publication.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  inspectPathAfterFailure,
  isSqliteContentError,
  preserveDataSafetyFailure,
  throwIfUnclassifiedFailure,
} from "./errors.js";
import { cleanupInterruptedInitializations, initializeDatabase } from "./initialize.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { inspectMigrationHistory, throwIfMigrationRuntimeFailure } from "./metadata.js";
import { removeOrphanedDatabaseArtifacts } from "./portable-database.js";
import { removeOrphanedRestoreCopies } from "./restore-paths.js";

function databaseMarkerPath(dbPath: string): string {
  return `${dbPath}${DATABASE_INITIALIZED_MARKER_SUFFIX}`;
}

function databaseMarkerExists(path: string): boolean {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return false;
  if (stats.isFile() && !stats.isSymbolicLink()) return true;
  throw new DataSafetyError(
    "database_corrupt",
    "The database initialization marker is not a regular file.",
  );
}

function markDatabaseInitialized(dbPath: string): void {
  const markerPath = databaseMarkerPath(dbPath);
  const temporaryPath = `${markerPath}.${randomUUID()}.partial`;
  try {
    removeOrphanedDatabaseArtifacts(dirname(dbPath), (filename) =>
      isUuidV4ArtifactName(filename, `${basename(markerPath)}.`, ".partial"),
    );
    if (databaseMarkerExists(markerPath)) return;
    writeFileSync(temporaryPath, "", { flag: "wx", mode: 0o600 });
    publishPathDurably(temporaryPath, markerPath);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => rmSync(temporaryPath, { force: true }));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "migration_failed",
      "The database initialization marker could not be published durably.",
    );
  }
}

function inspectExistingDatabase(dbPath: string): { pending: boolean } {
  let stats;
  try {
    stats = lstatSync(dbPath);
  } catch (error) {
    const inspection = inspectPathAfterFailure(dbPath, error);
    if (inspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before it could be inspected.",
        { cause: inspection.cause },
      );
    }
    throw inspection.cause;
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size === 0) {
    throw new DataSafetyError(
      "database_corrupt",
      "The existing database is not a non-empty regular file.",
    );
  }
  let client: ReturnType<typeof createClient>;
  try {
    client = createClient(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    if (isSqliteContentError(error)) {
      throw new DataSafetyError(
        "database_corrupt",
        "The existing file is not a valid SQLite database.",
        { cause: error },
      );
    }
    const inspection = inspectPathAfterFailure(dbPath, error);
    if (inspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before it could be inspected.",
        { cause: inspection.cause },
      );
    }
    throw inspection.cause;
  }
  const failures: unknown[] = [];
  let pending = false;
  try {
    assertDatabaseIntegrity(client.sqlite, "database_corrupt", "Database");
    const migrationHistory = inspectMigrationHistory(client.sqlite);
    if (!migrationHistory.present) {
      throw new DataSafetyError(
        "schema_incompatible",
        "The existing database has no Otomat migration history.",
      );
    }
    pending = migrationHistory.pending;
  } catch (error) {
    failures.push(error);
  }
  collectCleanupFailure(failures, () => client.sqlite.close());
  if (failures.length > 0) {
    const [primary, ...secondary] = failures;
    const classifiedPrimary = isSqliteContentError(primary)
      ? new DataSafetyError(
          "database_corrupt",
          "The existing SQLite database is structurally corrupt.",
          { cause: primary },
        )
      : primary;
    throwIfMigrationRuntimeFailure(
      classifiedPrimary,
      secondary,
      "Database migration metadata and handle cleanup both failed.",
    );
    throwIfUnclassifiedFailure(
      classifiedPrimary,
      secondary,
      "Database inspection and handle cleanup both failed.",
    );
    throw preserveDataSafetyFailure(
      classifiedPrimary,
      secondary,
      "database_corrupt",
      "The SQLite database could not be inspected safely.",
    );
  }
  return { pending };
}

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
