import { lstatSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { isTimestampedUuidV4ArtifactName, isUuidV4ArtifactName } from "./artifact-names.js";
import { collectCleanupFailure, preserveDataSafetyFailure } from "./errors.js";
import { removeOrphanedDatabaseArtifacts } from "./portable-database.js";
import { restoreJournalPath } from "./restore-journal.js";
import { isRestoreTemporaryName } from "./restore-paths.js";

export function removePartialRestoreState(dbPath: string): void {
  const backupsDirectory = join(dirname(dbPath), MANAGED_BACKUPS_DIRECTORY_NAME);
  const backupsStats = lstatSync(backupsDirectory, { throwIfNoEntry: false });
  const failures: unknown[] = [];
  if (backupsStats?.isDirectory() === true && !backupsStats.isSymbolicLink()) {
    for (const entry of readdirSync(backupsDirectory, { withFileTypes: true })) {
      if (
        isTimestampedUuidV4ArtifactName(entry.name, "pre-restore-", ".partial") &&
        (entry.isDirectory() || entry.isSymbolicLink())
      ) {
        collectCleanupFailure(failures, () => {
          const path = join(backupsDirectory, entry.name);
          if (entry.isSymbolicLink()) rmSync(path, { force: true });
          else rmSync(path, { recursive: true, force: true });
        });
      }
    }
  }

  const databaseDirectory = dirname(dbPath);
  const journalName = basename(restoreJournalPath(dbPath));
  for (const entry of readdirSync(databaseDirectory, { withFileTypes: true })) {
    if (
      isUuidV4ArtifactName(entry.name, `${journalName}.`, ".partial") &&
      (entry.isFile() || entry.isSymbolicLink())
    ) {
      collectCleanupFailure(failures, () =>
        rmSync(join(databaseDirectory, entry.name), { force: true }),
      );
    }
  }
  throwRestoreCleanupFailures(failures);
}

export function removeOrphanedRestoreCopies(dbPath: string): void {
  removeOrphanedDatabaseArtifacts(dirname(dbPath), (filename) =>
    isRestoreTemporaryName(dbPath, filename),
  );
}

export function findInterruptedRestoreCopies(dbPath: string): string[] {
  const databaseDirectory = dirname(dbPath);
  const paths: string[] = [];
  for (const entry of readdirSync(databaseDirectory, { withFileTypes: true })) {
    if (!isRestoreTemporaryName(dbPath, entry.name)) continue;
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error("An interrupted restore copy is not a regular managed file.");
    }
    paths.push(join(databaseDirectory, entry.name));
  }
  return paths;
}

export function throwRestoreCleanupFailures(failures: unknown[]): void {
  if (failures.length === 0) return;
  const [primary, ...secondary] = failures;
  throw preserveDataSafetyFailure(
    primary,
    secondary,
    "restore_failed",
    "Interrupted restore cleanup failed.",
  );
}
