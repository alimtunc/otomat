import { dirname } from "node:path";

import { createClient, type DbClient } from "../client.js";
import { assertSufficientDiskSpace, availableDiskBytes, requiredRestoreBytes } from "./capacity.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  inspectPathAfterFailure,
  isSqliteContentError,
  preserveClassifiedFailure,
  preserveDataSafetyFailure,
  throwIfUnclassifiedFailure,
} from "./errors.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { assertManagedBackup } from "./managed-backups-directory.js";
import { inspectMigrationHistory, throwIfMigrationRuntimeFailure } from "./metadata.js";
import {
  finalizePortableDatabase,
  removeDatabaseArtifacts,
  removeDatabaseSidecars,
} from "./portable-database.js";
import {
  existingDatabaseArtifacts,
  preserveAndInstallRestore,
  type RestoreArtifact,
  type RestoreInstallation,
} from "./restore-installation.js";
import { createRestoreTemporaryPath, removeOrphanedRestoreCopies } from "./restore-paths.js";

function closeRestoreSource(source: DbClient, backupPath: string, failures: unknown[]): void {
  const failureCount = failures.length;
  collectCleanupFailure(failures, () => source.sqlite.close());
  if (failures.length === failureCount) {
    collectCleanupFailure(failures, () => removeDatabaseSidecars(backupPath));
  }
}

async function createValidatedRestoreCopy(
  dbPath: string,
  backupPath: string,
  temporaryPath: string,
): Promise<RestoreArtifact[]> {
  const currentArtifacts = existingDatabaseArtifacts(dbPath);
  let source: DbClient;
  try {
    source = createClient(backupPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    if (isSqliteContentError(error)) {
      throw new DataSafetyError(
        "invalid_backup",
        "The selected backup is not a valid SQLite database.",
        { cause: error },
      );
    }
    const inspection = inspectPathAfterFailure(backupPath, error);
    if (inspection.missing) {
      throw new DataSafetyError("invalid_backup", "The selected backup no longer exists.", {
        cause: inspection.cause,
      });
    }
    throw inspection.cause;
  }
  const validationFailures: unknown[] = [];
  let hasPendingMigrations = false;
  try {
    assertDatabaseIntegrity(source.sqlite, "invalid_backup", "Backup");
    const migrationHistory = inspectMigrationHistory(source.sqlite);
    hasPendingMigrations = migrationHistory.pending;
    if (migrationHistory.appliedCount === 0) {
      throw new DataSafetyError(
        "invalid_backup",
        "The selected backup has no Otomat migration history.",
      );
    }
  } catch (error) {
    validationFailures.push(error);
  }
  if (validationFailures.length > 0) {
    closeRestoreSource(source, backupPath, validationFailures);
    const [primary, ...secondary] = validationFailures;
    const classifiedPrimary = isSqliteContentError(primary)
      ? new DataSafetyError("invalid_backup", "The selected backup is structurally corrupt.", {
          cause: primary,
        })
      : primary;
    throwIfMigrationRuntimeFailure(
      classifiedPrimary,
      secondary,
      "Migration metadata and backup handle cleanup both failed.",
    );
    throwIfUnclassifiedFailure(
      classifiedPrimary,
      secondary,
      "Backup validation and handle cleanup both failed.",
    );
    throw preserveClassifiedFailure(classifiedPrimary, secondary);
  }
  const stagingFailures: unknown[] = [];
  try {
    assertSufficientDiskSpace(
      availableDiskBytes(dirname(dbPath)),
      requiredRestoreBytes(source.sqlite, hasPendingMigrations),
    );
    await source.sqlite.backup(temporaryPath);
  } catch (error) {
    stagingFailures.push(error);
  }
  closeRestoreSource(source, backupPath, stagingFailures);
  if (stagingFailures.length > 0) {
    const [primary, ...secondary] = stagingFailures;
    collectCleanupFailure(secondary, () => removeDatabaseArtifacts(temporaryPath));
    throw preserveDataSafetyFailure(
      primary,
      secondary,
      "restore_failed",
      "The validated backup could not be copied for restoration.",
    );
  }
  try {
    finalizePortableDatabase(temporaryPath, "Restored database");
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(temporaryPath));
    throwIfMigrationRuntimeFailure(
      error,
      cleanupFailures,
      "Migration metadata and staged restore cleanup both failed.",
    );
    throwIfUnclassifiedFailure(error, cleanupFailures, "Restore staging and cleanup both failed.");
    throw preserveClassifiedFailure(
      new DataSafetyError(
        "restore_failed",
        "The staged restore copy could not be finalized safely.",
        { cause: error },
      ),
      cleanupFailures,
    );
  }
  return currentArtifacts;
}

export async function restoreDatabaseBackup(
  dbPath: string,
  backupPath: string,
  now = new Date(),
): Promise<RestoreInstallation> {
  removeOrphanedRestoreCopies(dbPath);
  assertManagedBackup(dbPath, backupPath);
  const temporaryPath = createRestoreTemporaryPath(dbPath);
  let currentArtifacts: RestoreArtifact[];
  try {
    currentArtifacts = await createValidatedRestoreCopy(dbPath, backupPath, temporaryPath);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(temporaryPath));
    throwIfMigrationRuntimeFailure(
      error,
      cleanupFailures,
      "Migration metadata and restore cleanup both failed.",
    );
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "Database restoration failed.",
      { backupPath },
    );
  }
  return preserveAndInstallRestore({
    artifacts: currentArtifacts,
    backupPath,
    dbPath,
    now,
    temporaryPath,
  });
}
