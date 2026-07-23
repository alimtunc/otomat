import { randomUUID } from "node:crypto";
import { lstatSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { isUuidV4ArtifactName } from "./artifact-names.js";
import { DataSafetyError } from "./errors.js";
import { removeOrphanedDatabaseArtifacts } from "./portable-database.js";

const RESTORE_TEMPORARY_SUFFIX = ".partial";

function restoreTemporaryPrefix(dbPath: string): string {
  return `${basename(dbPath)}.restore-`;
}

export function createRestoreTemporaryPath(dbPath: string): string {
  return join(
    dirname(dbPath),
    `${restoreTemporaryPrefix(dbPath)}${randomUUID()}${RESTORE_TEMPORARY_SUFFIX}`,
  );
}

function isRestoreTemporaryName(dbPath: string, filename: string): boolean {
  return isUuidV4ArtifactName(filename, restoreTemporaryPrefix(dbPath), RESTORE_TEMPORARY_SUFFIX);
}

/**
 * A restore copy is only ever staged under a generated name; one left behind means
 * the process died before installation, so the current database was never touched.
 */
export function removeOrphanedRestoreCopies(dbPath: string): void {
  const databaseDirectory = dirname(dbPath);
  if (lstatSync(databaseDirectory, { throwIfNoEntry: false }) === undefined) return;
  try {
    removeOrphanedDatabaseArtifacts(databaseDirectory, (filename) =>
      isRestoreTemporaryName(dbPath, filename),
    );
  } catch (error) {
    throw new DataSafetyError(
      "restore_failed",
      "Interrupted restore copies could not be cleaned safely.",
      { cause: error },
    );
  }
}
