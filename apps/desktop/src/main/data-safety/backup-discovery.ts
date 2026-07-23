import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { isManagedBackupFilename } from "@otomat/domain";

import { combineFailures } from "./failure-composition.js";

function isVanishedCandidate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ELOOP")
  );
}

function inspectBackupCandidate(path: string): { path: string; modifiedAt: number } | null {
  let descriptor: number | null = null;
  let candidate: { path: string; modifiedAt: number } | null = null;
  const failures: unknown[] = [];
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = fstatSync(descriptor);
    if (stats.isFile()) candidate = { path, modifiedAt: stats.mtimeMs };
  } catch (error) {
    if (!isVanishedCandidate(error)) failures.push(error);
  }
  if (descriptor !== null) {
    try {
      closeSync(descriptor);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw combineFailures(failures, "Backup inspection and handle cleanup both failed.");
  }
  return candidate;
}

export function findLatestManagedBackup(
  backupsDirectory: string,
  databaseFilename: string,
  excludedPaths: ReadonlySet<string> = new Set(),
): string | null {
  const directoryStats = lstatSync(backupsDirectory, { throwIfNoEntry: false });
  if (directoryStats === undefined) return null;
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    throw new Error("The managed backups path is not a regular directory.");
  }
  const backups = readdirSync(backupsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isManagedBackupFilename(entry.name, databaseFilename))
    .map((entry) => inspectBackupCandidate(join(backupsDirectory, entry.name)))
    .filter(
      (backup): backup is { path: string; modifiedAt: number } =>
        backup !== null && !excludedPaths.has(backup.path),
    )
    .toSorted(
      (left, right) => right.modifiedAt - left.modifiedAt || right.path.localeCompare(left.path),
    );
  return backups[0]?.path ?? null;
}
