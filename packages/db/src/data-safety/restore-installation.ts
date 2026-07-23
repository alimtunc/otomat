import { randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { MANAGED_BACKUPS_DIRECTORY_NAME } from "@otomat/domain";

import {
  PathReplacementSyncError,
  publishPathDurably,
  replacePathDurably,
  syncManagedPath,
} from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import { assertManagedBackupsDirectory } from "./managed-backups-directory.js";
import { removeDatabaseArtifacts, removeDatabaseSidecars } from "./portable-database.js";
import {
  removeRestoreJournal,
  restoreJournalPath,
  writeRestoreJournal,
} from "./restore-journal.js";

export interface RestoreArtifact {
  source: string;
  name: string;
  size: number;
}

export interface RestoreInstallation {
  preservedPath: string | null;
}

export interface RestoreInstallationPlan {
  artifacts: RestoreArtifact[];
  backupPath: string;
  dbPath: string;
  journalPublication: "create" | "replace";
  now: Date;
  temporaryPath: string;
}

export function finishInstalledRestore(dbPath: string): void {
  removeDatabaseSidecars(dbPath);
  syncManagedPath(dirname(dbPath));
  removeRestoreJournal(dbPath);
}

export function existingDatabaseArtifacts(
  dbPath: string,
  ambiguousRestoreCopies: readonly string[] | null = null,
): RestoreArtifact[] {
  const artifacts: RestoreArtifact[] = [];
  const sources = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  if (ambiguousRestoreCopies !== null) {
    sources.push(restoreJournalPath(dbPath));
    for (const restoreCopy of ambiguousRestoreCopies) {
      sources.push(restoreCopy, `${restoreCopy}-wal`, `${restoreCopy}-shm`);
    }
  }
  for (const source of sources) {
    const stats = lstatSync(source, { throwIfNoEntry: false });
    if (stats === undefined) continue;
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new DataSafetyError(
        "restore_failed",
        "The current database artifacts are not regular managed files.",
      );
    }
    artifacts.push({ source, name: basename(source), size: stats.size });
  }
  if (
    ambiguousRestoreCopies !== null &&
    !artifacts.some((artifact) => artifact.source === restoreJournalPath(dbPath))
  ) {
    throw new DataSafetyError(
      "restore_failed",
      "The ambiguous restore journal disappeared before preservation.",
    );
  }
  return artifacts;
}

export function databaseArtifactBytes(artifacts: RestoreArtifact[]): number {
  return artifacts.reduce((total, artifact) => total + artifact.size, 0);
}

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
  try {
    assertManagedBackupsDirectory(dirname(preservedPath));
    mkdirSync(partialPath);
    for (const artifact of artifacts) {
      const destination = join(partialPath, artifact.name);
      copyFileSync(artifact.source, destination);
      chmodSync(destination, 0o600);
      syncManagedPath(destination);
    }
    publishPathDurably(partialPath, preservedPath);
    return preservedPath;
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () =>
      rmSync(partialPath, { recursive: true, force: true }),
    );
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "The current database state could not be preserved.",
    );
  }
}

export function preserveAndInstallRestore(plan: RestoreInstallationPlan): RestoreInstallation {
  let preservedPath: string | null;
  try {
    preservedPath = preserveDatabaseArtifacts(plan.dbPath, plan.artifacts, plan.now);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(plan.temporaryPath));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "Database restoration failed before journal publication.",
      { backupPath: plan.backupPath },
    );
  }
  let installed = false;
  try {
    writeRestoreJournal(plan.dbPath, plan.temporaryPath, plan.journalPublication);
    syncManagedPath(plan.temporaryPath);
    chmodSync(plan.temporaryPath, 0o600);
    replacePathDurably(plan.temporaryPath, plan.dbPath);
    installed = true;
    finishInstalledRestore(plan.dbPath);
    return { preservedPath };
  } catch (error) {
    if (error instanceof PathReplacementSyncError) installed = true;
    if (installed) {
      throw preserveDataSafetyFailure(
        error,
        [],
        "restore_failed",
        "The restored database was installed but its recovery journal remains.",
        { backupPath: plan.backupPath },
      );
    }
    if (plan.journalPublication === "replace") {
      throw preserveDataSafetyFailure(
        error,
        [],
        "restore_failed",
        "The explicit restore is journaled for recovery after installation failed.",
        { backupPath: plan.backupPath },
      );
    }
    const rollbackFailures: unknown[] = [];
    collectCleanupFailure(rollbackFailures, () => removeRestoreJournal(plan.dbPath));
    if (rollbackFailures.length === 0) {
      collectCleanupFailure(rollbackFailures, () => removeDatabaseArtifacts(plan.temporaryPath));
    }
    throw preserveDataSafetyFailure(
      error,
      rollbackFailures,
      "restore_failed",
      "Database restoration failed.",
      { backupPath: plan.backupPath },
    );
  }
}
