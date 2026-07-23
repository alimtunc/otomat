import { dirname } from "node:path";

import { createClient, type DbClient } from "../client.js";
import { assertSufficientDiskSpace, availableDiskBytes, requiredRestoreBytes } from "./capacity.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  inspectPathAfterFailure,
  isSqliteContentError,
  preserveDataSafetyFailure,
  throwIfUnclassifiedFailure,
} from "./errors.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { assertManagedBackup } from "./managed-backups-directory.js";
import { inspectMigrationHistory, throwIfMigrationRuntimeFailure } from "./metadata.js";
import {
  finalizePortableDatabase,
  removeDatabaseArtifacts,
  removeOrphanedDatabaseArtifacts,
  removeDatabaseSidecars,
} from "./portable-database.js";
import {
  databaseArtifactBytes,
  existingDatabaseArtifacts,
  preserveAndInstallRestore,
  type RestoreInstallation,
} from "./restore-installation.js";
import { createRestoreTemporaryPath, isRestoreTemporaryName } from "./restore-paths.js";
import { AmbiguousRestoreJournalError, recoverInterruptedRestore } from "./restore-recovery.js";

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
  ambiguousRestoreCopies: readonly string[] | null,
): Promise<ReturnType<typeof existingDatabaseArtifacts>> {
  const currentArtifacts = existingDatabaseArtifacts(dbPath, ambiguousRestoreCopies);
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
    throw preserveDataSafetyFailure(
      classifiedPrimary,
      secondary,
      "invalid_backup",
      "The backup could not be opened safely.",
    );
  }
  const stagingFailures: unknown[] = [];
  try {
    assertSufficientDiskSpace(
      availableDiskBytes(dirname(dbPath)),
      requiredRestoreBytes(
        source.sqlite,
        databaseArtifactBytes(currentArtifacts),
        hasPendingMigrations,
      ),
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
    throw preserveDataSafetyFailure(
      new DataSafetyError(
        "restore_failed",
        "The staged restore copy could not be finalized safely.",
        { cause: error },
      ),
      cleanupFailures,
      "restore_failed",
      "The staged restore copy could not be finalized safely.",
    );
  }
  return currentArtifacts;
}

export async function restoreDatabaseBackup(
  dbPath: string,
  backupPath: string,
  now = new Date(),
): Promise<RestoreInstallation> {
  let ambiguousRestoreCopies: string[] | null = null;
  try {
    recoverInterruptedRestore(dbPath);
  } catch (error) {
    if (!(error instanceof AmbiguousRestoreJournalError)) throw error;
    ambiguousRestoreCopies = error.restoreCopies;
  }
  assertManagedBackup(dbPath, backupPath);
  const databaseDirectory = dirname(dbPath);
  if (ambiguousRestoreCopies === null) {
    try {
      removeOrphanedDatabaseArtifacts(databaseDirectory, (filename) =>
        isRestoreTemporaryName(dbPath, filename),
      );
    } catch (error) {
      throw new DataSafetyError(
        "restore_failed",
        "Interrupted restore copies could not be cleaned before restoration.",
        { backupPath, cause: error },
      );
    }
  }
  const temporaryPath = createRestoreTemporaryPath(dbPath);
  let currentArtifacts: ReturnType<typeof existingDatabaseArtifacts>;
  try {
    currentArtifacts = await createValidatedRestoreCopy(
      dbPath,
      backupPath,
      temporaryPath,
      ambiguousRestoreCopies,
    );
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
    journalPublication: ambiguousRestoreCopies === null ? "create" : "replace",
    now,
    temporaryPath,
  });
}
