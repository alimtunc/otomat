import { randomUUID } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import { publishPathDurably, replacePathDurably, syncManagedPath } from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import { assertManagedBackupsDirectory } from "./managed-backups-directory.js";
import { removeDatabaseArtifacts } from "./portable-database.js";

export interface RestoreArtifact {
  source: string;
  name: string;
}

export interface RestoreInstallation {
  preservedPath: string | null;
}

export interface RestoreInstallationPlan {
  artifacts: RestoreArtifact[];
  backupPath: string;
  dbPath: string;
  now: Date;
  temporaryPath: string;
}

export function existingDatabaseArtifacts(dbPath: string): RestoreArtifact[] {
  const artifacts: RestoreArtifact[] = [];
  for (const source of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    const stats = lstatSync(source, { throwIfNoEntry: false });
    if (stats === undefined) continue;
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new DataSafetyError(
        "restore_failed",
        "The current database artifacts are not regular managed files.",
      );
    }
    artifacts.push({ source, name: basename(source) });
  }
  return artifacts;
}

/**
 * Moves the current database and its sidecars aside as one set. A crash after any
 * move leaves no database rather than a database stripped of its WAL, so recovery
 * is an explicit `database_missing` prompt instead of a silently older database.
 */
function preserveDatabaseArtifacts(
  dbPath: string,
  artifacts: RestoreArtifact[],
  now: Date,
): string | null {
  if (artifacts.length === 0) return null;
  const preservedPath = join(
    dirname(dbPath),
    MANAGED_BACKUPS_DIRECTORY_NAME,
    `pre-restore-${now.toISOString().replaceAll(":", "-")}-${randomUUID()}`,
  );
  const partialPath = `${preservedPath}.partial`;
  const moved: RestoreArtifact[] = [];
  try {
    assertManagedBackupsDirectory(dirname(preservedPath));
    mkdirSync(partialPath, { mode: 0o700 });
    for (const artifact of artifacts) {
      renameSync(artifact.source, join(partialPath, artifact.name));
      moved.push(artifact);
    }
    syncManagedPath(dirname(dbPath));
    publishPathDurably(partialPath, preservedPath);
    return preservedPath;
  } catch (error) {
    const rollbackFailures: unknown[] = [];
    for (const artifact of moved.toReversed()) {
      collectCleanupFailure(rollbackFailures, () =>
        renameSync(join(partialPath, artifact.name), artifact.source),
      );
    }
    // Only an emptied staging directory is removable; a partial rollback still holds user data.
    if (rollbackFailures.length === 0) {
      collectCleanupFailure(rollbackFailures, () =>
        rmSync(partialPath, { recursive: true, force: true }),
      );
    }
    throw preserveDataSafetyFailure(
      error,
      rollbackFailures,
      "restore_failed",
      "The current database state could not be preserved.",
    );
  }
}

export function preserveAndInstallRestore(plan: RestoreInstallationPlan): RestoreInstallation {
  let preservedPath: string | null;
  try {
    // Prove the staged copy is on disk before the current database is moved aside.
    syncManagedPath(plan.temporaryPath);
    chmodSync(plan.temporaryPath, 0o600);
    preservedPath = preserveDatabaseArtifacts(plan.dbPath, plan.artifacts, plan.now);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(plan.temporaryPath));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "Database restoration failed before the current database was preserved.",
      { backupPath: plan.backupPath },
    );
  }
  try {
    replacePathDurably(plan.temporaryPath, plan.dbPath);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(plan.temporaryPath));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "The validated restore copy could not be installed. The preserved database is in the backups directory.",
      { backupPath: plan.backupPath },
    );
  }
  return { preservedPath };
}
