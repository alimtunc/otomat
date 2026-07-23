import { lstatSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

import { isManagedBackupFilename, MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { DataSafetyError } from "./errors.js";

export function assertManagedBackupsDirectory(path: string): void {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats?.isDirectory() === true && !stats.isSymbolicLink()) return;
  throw new Error("The managed backups path is not a regular directory.");
}

export function ensureManagedBackupsDirectory(path: string): void {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) mkdirSync(path, { mode: 0o700 });
  assertManagedBackupsDirectory(path);
}

export function assertManagedBackup(dbPath: string, backupPath: string): void {
  const managedDirectory = resolve(dirname(dbPath), MANAGED_BACKUPS_DIRECTORY_NAME);
  const backupName = basename(backupPath);
  let validFile = false;
  let inspectionFailure: unknown = null;
  try {
    assertManagedBackupsDirectory(managedDirectory);
    const stats = lstatSync(backupPath);
    validFile =
      stats.isFile() &&
      !stats.isSymbolicLink() &&
      lstatSync(`${backupPath}-wal`, { throwIfNoEntry: false }) === undefined &&
      lstatSync(`${backupPath}-shm`, { throwIfNoEntry: false }) === undefined;
  } catch (error) {
    inspectionFailure = error;
  }
  if (
    dirname(resolve(backupPath)) !== managedDirectory ||
    !isManagedBackupFilename(backupName, basename(dbPath)) ||
    !validFile
  ) {
    throw new DataSafetyError(
      "invalid_backup",
      "Only an existing backup from the managed backups directory can be restored.",
      inspectionFailure === null ? undefined : { cause: inspectionFailure },
    );
  }
}
