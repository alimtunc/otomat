import { randomUUID } from "node:crypto";
import { chmodSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  isManagedBackupFilename,
  managedBackupFilenamePrefix,
  MANAGED_BACKUP_FILENAME_SUFFIX,
} from "@otomat/domain";

import { createClient } from "../client.js";
import {
  assertSufficientDiskSpace,
  availableDiskBytes,
  requiredPreMigrationBytes,
} from "./capacity.js";
import { publishPathDurably, syncManagedPath } from "./durable-publication.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  inspectPathAfterFailure,
  preserveDataSafetyFailure,
} from "./errors.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { ensureManagedBackupsDirectory } from "./managed-backups-directory.js";
import {
  finalizePortableDatabase,
  removeDatabaseArtifacts,
  removeOrphanedDatabaseArtifacts,
} from "./portable-database.js";

function timestampForPath(now: Date): string {
  return now.toISOString().replaceAll(":", "-");
}

export async function createConsistentBackup(
  dbPath: string,
  backupsDir: string,
  now = new Date(),
): Promise<string> {
  const backupPrefix = managedBackupFilenamePrefix(basename(dbPath));
  try {
    ensureManagedBackupsDirectory(backupsDir);
    syncManagedPath(dirname(backupsDir));
    removeOrphanedDatabaseArtifacts(
      backupsDir,
      (filename) =>
        filename.endsWith(".partial") &&
        isManagedBackupFilename(filename.slice(0, -".partial".length), basename(dbPath)),
    );
  } catch (error) {
    throw new DataSafetyError(
      "backup_failed",
      "The managed backup directory could not be prepared safely.",
      { cause: error },
    );
  }
  let source: ReturnType<typeof createClient> | null = null;
  const backupName = `${backupPrefix}${timestampForPath(now)}-${randomUUID()}${MANAGED_BACKUP_FILENAME_SUFFIX}`;
  const backupPath = join(backupsDir, backupName);
  const temporaryPath = `${backupPath}.partial`;
  const sourceFailures: unknown[] = [];
  try {
    source = createClient(dbPath, { readonly: true, fileMustExist: true });
    assertDatabaseIntegrity(source.sqlite, "database_corrupt", "Database");
    assertSufficientDiskSpace(
      availableDiskBytes(backupsDir),
      requiredPreMigrationBytes(source.sqlite),
    );
    removeDatabaseArtifacts(temporaryPath);
    await source.sqlite.backup(temporaryPath);
  } catch (error) {
    sourceFailures.push(error);
  }
  if (source !== null) {
    const openedSource = source;
    collectCleanupFailure(sourceFailures, () => openedSource.sqlite.close());
  }
  if (sourceFailures.length > 0) {
    const [operationFailure, ...secondary] = sourceFailures;
    const inspection = inspectPathAfterFailure(dbPath, operationFailure);
    const primary = inspection.missing
      ? new DataSafetyError(
          "database_missing",
          "The initialized database disappeared before backup.",
          { cause: inspection.cause },
        )
      : inspection.cause;
    collectCleanupFailure(secondary, () => removeDatabaseArtifacts(temporaryPath));
    throw preserveDataSafetyFailure(
      primary,
      secondary,
      "backup_failed",
      "The database backup could not be created safely.",
    );
  }

  const finalizationFailures: unknown[] = [];
  try {
    finalizePortableDatabase(temporaryPath, "Backup");
    chmodSync(temporaryPath, 0o600);
    publishPathDurably(temporaryPath, backupPath);
  } catch (error) {
    finalizationFailures.push(error);
  }
  if (finalizationFailures.length > 0) {
    const [primary, ...secondary] = finalizationFailures;
    collectCleanupFailure(secondary, () => removeDatabaseArtifacts(temporaryPath));
    throw new DataSafetyError(
      "backup_failed",
      "The database backup could not be finalized safely.",
      {
        cause:
          secondary.length === 0
            ? primary
            : new AggregateError(
                [primary, ...secondary],
                "Backup finalization and cleanup both failed.",
              ),
      },
    );
  }
  return backupPath;
}
