import { lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "../client.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  isSqliteContentError,
  type DataSafetyErrorCode,
  preserveDataSafetyFailure,
  throwIfUnclassifiedFailure,
} from "./errors.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { inspectMigrationHistory, throwIfMigrationRuntimeFailure } from "./metadata.js";

function removePaths(paths: string[]): void {
  const failures: unknown[] = [];
  for (const path of paths) {
    collectCleanupFailure(failures, () => rmSync(path, { force: true }));
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more database artifacts could not be removed.");
  }
}

function portableDatabaseError(
  code: Extract<DataSafetyErrorCode, "invalid_backup" | "restore_failed">,
  message: string,
): DataSafetyError {
  return code === "invalid_backup"
    ? new DataSafetyError("invalid_backup", message)
    : new DataSafetyError("restore_failed", message);
}

export function removeDatabaseSidecars(path: string): void {
  removePaths([`${path}-wal`, `${path}-shm`]);
}

export function removeDatabaseArtifacts(path: string): void {
  removePaths([path, `${path}-wal`, `${path}-shm`]);
}

export function removeOrphanedDatabaseArtifacts(
  directory: string,
  isManagedArtifactName: (filename: string) => boolean,
): void {
  const artifactBases = new Set<string>();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    if (isManagedArtifactName(entry.name)) {
      artifactBases.add(entry.name);
      continue;
    }
    const artifactBase =
      entry.name.endsWith("-wal") || entry.name.endsWith("-shm") ? entry.name.slice(0, -4) : null;
    if (artifactBase !== null && isManagedArtifactName(artifactBase)) {
      artifactBases.add(artifactBase);
    }
  }
  const failures: unknown[] = [];
  for (const artifactBase of artifactBases) {
    collectCleanupFailure(failures, () => removeDatabaseArtifacts(join(directory, artifactBase)));
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Orphaned database artifacts could not be removed.");
  }
}

export function validatePortableDatabase(
  path: string,
  label: string,
  code: Extract<DataSafetyErrorCode, "invalid_backup" | "restore_failed">,
): void {
  if (
    lstatSync(`${path}-wal`, { throwIfNoEntry: false }) !== undefined ||
    lstatSync(`${path}-shm`, { throwIfNoEntry: false }) !== undefined
  ) {
    throw portableDatabaseError(code, `${label} has SQLite sidecars and is not portable.`);
  }
  const portable = createClient(path, { readonly: true, fileMustExist: true });
  const validationFailures: unknown[] = [];
  try {
    assertDatabaseIntegrity(portable.sqlite, code, label);
    if (inspectMigrationHistory(portable.sqlite).appliedCount === 0) {
      throw portableDatabaseError(code, `${label} has no Otomat migration history.`);
    }
  } catch (error) {
    validationFailures.push(error);
  }
  collectCleanupFailure(validationFailures, () => portable.sqlite.close());
  if (validationFailures.length > 0) {
    const [primary, ...secondary] = validationFailures;
    const classifiedPrimary = isSqliteContentError(primary)
      ? portableDatabaseError(code, `${label} is structurally corrupt.`)
      : primary;
    throwIfMigrationRuntimeFailure(
      classifiedPrimary,
      secondary,
      `${label} migration metadata and handle cleanup both failed.`,
    );
    throwIfUnclassifiedFailure(
      classifiedPrimary,
      secondary,
      `${label} validation and handle cleanup both failed.`,
    );
    throw preserveDataSafetyFailure(
      classifiedPrimary,
      secondary,
      code,
      `${label} could not be validated safely.`,
    );
  }
}

function isCheckpointStatus(
  value: unknown,
): value is { busy: number; log: number; checkpointed: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "busy" in value &&
    typeof value.busy === "number" &&
    "log" in value &&
    typeof value.log === "number" &&
    "checkpointed" in value &&
    typeof value.checkpointed === "number"
  );
}

export function finalizePortableDatabase(path: string, label: string): void {
  const checkpoint = createClient(path, { fileMustExist: true });
  const checkpointFailures: unknown[] = [];
  try {
    assertDatabaseIntegrity(checkpoint.sqlite, "invalid_backup", label);
    const checkpointRows: unknown = checkpoint.sqlite.pragma("wal_checkpoint(TRUNCATE)");
    const checkpointStatus =
      Array.isArray(checkpointRows) && checkpointRows.length === 1 ? checkpointRows[0] : undefined;
    if (
      !isCheckpointStatus(checkpointStatus) ||
      checkpointStatus.busy !== 0 ||
      checkpointStatus.checkpointed !== checkpointStatus.log
    ) {
      throw new DataSafetyError(
        "invalid_backup",
        `${label} could not be checkpointed into a standalone SQLite file.`,
      );
    }
  } catch (error) {
    checkpointFailures.push(error);
  }
  collectCleanupFailure(checkpointFailures, () => checkpoint.sqlite.close());
  if (checkpointFailures.length > 0) {
    const [primary, ...secondary] = checkpointFailures;
    throwIfUnclassifiedFailure(
      primary,
      secondary,
      `${label} checkpoint and handle cleanup both failed.`,
    );
    throw preserveDataSafetyFailure(
      primary,
      secondary,
      "invalid_backup",
      `${label} could not be finalized safely.`,
    );
  }
  removeDatabaseSidecars(path);

  validatePortableDatabase(path, label, "invalid_backup");
  removeDatabaseSidecars(path);
}
