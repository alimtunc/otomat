import { chmodSync, lstatSync } from "node:fs";
import { dirname } from "node:path";

import { replacePathDurably, syncManagedPath } from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import { isMigrationRuntimeError, throwIfMigrationRuntimeFailure } from "./metadata.js";
import { removeDatabaseArtifacts, validatePortableDatabase } from "./portable-database.js";
import { finishInstalledRestore } from "./restore-installation.js";
import {
  readRestoreJournal,
  removeRestoreJournal,
  type RestoreJournalState,
} from "./restore-journal.js";
import {
  findInterruptedRestoreCopies,
  removeOrphanedRestoreCopies,
  removePartialRestoreState,
  throwRestoreCleanupFailures,
} from "./restore-recovery-cleanup.js";

export class AmbiguousRestoreJournalError extends DataSafetyError {
  constructor(
    readonly restoreCopies: string[],
    cause: unknown,
  ) {
    super("restore_failed", "The unreadable restore journal has ambiguous database sidecars.", {
      cause,
    });
    this.name = "AmbiguousRestoreJournalError";
  }
}

function abandonRestoreCopy(dbPath: string, temporaryPath: string, primaryFailure: unknown): never {
  const cleanupFailures: unknown[] = [];
  collectCleanupFailure(cleanupFailures, () => removeRestoreJournal(dbPath));
  if (cleanupFailures.length === 0) {
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(temporaryPath));
  }
  throw preserveDataSafetyFailure(
    primaryFailure,
    cleanupFailures,
    "restore_failed",
    "The interrupted restore copy could not be abandoned safely.",
  );
}

function installJournaledRestore(dbPath: string, journal: RestoreJournalState): void {
  syncManagedPath(journal.temporaryPath);
  chmodSync(journal.temporaryPath, 0o600);
  replacePathDurably(journal.temporaryPath, dbPath);
  finishInstalledRestore(dbPath);
}

function matchesJournalIdentity(
  stats: { dev: bigint; ino: bigint },
  journal: RestoreJournalState,
): boolean {
  return (
    String(stats.dev) === journal.temporaryDevice && String(stats.ino) === journal.temporaryInode
  );
}

function completeJournaledRestore(dbPath: string, journal: RestoreJournalState): void {
  const temporaryStats = lstatSync(journal.temporaryPath, {
    bigint: true,
    throwIfNoEntry: false,
  });
  if (temporaryStats === undefined) {
    const databaseStats = lstatSync(dbPath, { bigint: true, throwIfNoEntry: false });
    if (databaseStats === undefined) {
      abandonRestoreCopy(
        dbPath,
        journal.temporaryPath,
        new DataSafetyError(
          "restore_failed",
          "The interrupted restore has neither an installable copy nor a database.",
        ),
      );
    }
    if (
      databaseStats.isFile() &&
      !databaseStats.isSymbolicLink() &&
      matchesJournalIdentity(databaseStats, journal)
    ) {
      finishInstalledRestore(dbPath);
      return;
    }
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeRestoreJournal(dbPath));
    throw preserveDataSafetyFailure(
      new DataSafetyError(
        "restore_failed",
        "The staged restore copy disappeared before atomic installation.",
      ),
      cleanupFailures,
      "restore_failed",
      "The interrupted restore was abandoned without changing the current database sidecars.",
    );
  }
  if (
    !temporaryStats.isFile() ||
    temporaryStats.isSymbolicLink() ||
    !matchesJournalIdentity(temporaryStats, journal)
  ) {
    abandonRestoreCopy(
      dbPath,
      journal.temporaryPath,
      new DataSafetyError(
        "restore_failed",
        "The interrupted restore copy is not a regular managed file.",
      ),
    );
  }
  try {
    validatePortableDatabase(
      journal.temporaryPath,
      "The interrupted restore copy",
      "restore_failed",
    );
  } catch (validationFailure) {
    if (isMigrationRuntimeError(validationFailure)) throw validationFailure;
    abandonRestoreCopy(dbPath, journal.temporaryPath, validationFailure);
  }
  installJournaledRestore(dbPath, journal);
}

function recoverUnreadableJournal(
  dbPath: string,
  journalFailure: unknown,
  priorCleanupFailures: unknown[],
): never {
  let restoreCopies: string[];
  try {
    restoreCopies = findInterruptedRestoreCopies(dbPath);
  } catch (inspectionFailure) {
    throw preserveDataSafetyFailure(
      journalFailure,
      [...priorCleanupFailures, inspectionFailure],
      "restore_failed",
      "The unreadable restore journal has ambiguous managed artifacts.",
    );
  }
  const journalAndPriorCleanupFailure =
    priorCleanupFailures.length === 0
      ? journalFailure
      : new AggregateError(
          [journalFailure, ...priorCleanupFailures],
          "Restore-journal inspection and prior cleanup both failed.",
        );
  if (restoreCopies.length > 1) {
    throw new AmbiguousRestoreJournalError(restoreCopies, journalAndPriorCleanupFailure);
  }
  if (restoreCopies.length === 1) {
    abandonRestoreCopy(dbPath, restoreCopies[0], journalAndPriorCleanupFailure);
  }
  let databaseStats;
  let hasSidecars: boolean;
  try {
    databaseStats = lstatSync(dbPath, { throwIfNoEntry: false });
    hasSidecars =
      lstatSync(`${dbPath}-wal`, { throwIfNoEntry: false }) !== undefined ||
      lstatSync(`${dbPath}-shm`, { throwIfNoEntry: false }) !== undefined;
  } catch (inspectionFailure) {
    throw preserveDataSafetyFailure(
      journalFailure,
      [...priorCleanupFailures, inspectionFailure],
      "restore_failed",
      "The database artifacts could not be inspected after an unreadable restore journal.",
    );
  }
  if (databaseStats?.isFile() === true && !databaseStats.isSymbolicLink()) {
    if (hasSidecars) {
      throw new AmbiguousRestoreJournalError([], journalAndPriorCleanupFailure);
    }
    const cleanupFailures = [...priorCleanupFailures];
    collectCleanupFailure(cleanupFailures, () => removeRestoreJournal(dbPath));
    throw preserveDataSafetyFailure(
      journalFailure,
      cleanupFailures,
      "restore_failed",
      "The unreadable journal was removed after completing the installed restore.",
    );
  }
  const cleanupFailures = [...priorCleanupFailures];
  collectCleanupFailure(cleanupFailures, () => removeRestoreJournal(dbPath));
  throw preserveDataSafetyFailure(
    journalFailure,
    cleanupFailures,
    "restore_failed",
    "The unreadable restore journal was abandoned without a database.",
  );
}

export function recoverInterruptedRestore(dbPath: string): void {
  if (lstatSync(dirname(dbPath), { throwIfNoEntry: false }) === undefined) return;
  const cleanupFailures: unknown[] = [];
  collectCleanupFailure(cleanupFailures, () => removePartialRestoreState(dbPath));
  let journal: RestoreJournalState | null;
  try {
    journal = readRestoreJournal(dbPath);
  } catch (journalFailure) {
    recoverUnreadableJournal(dbPath, journalFailure, cleanupFailures);
  }
  if (journal === null) {
    collectCleanupFailure(cleanupFailures, () => removeOrphanedRestoreCopies(dbPath));
    throwRestoreCleanupFailures(cleanupFailures);
    return;
  }
  try {
    completeJournaledRestore(dbPath, journal);
  } catch (restoreFailure) {
    throwIfMigrationRuntimeFailure(
      restoreFailure,
      cleanupFailures,
      "Migration metadata and interrupted-restore cleanup both failed.",
    );
    throw preserveDataSafetyFailure(
      restoreFailure,
      cleanupFailures,
      "restore_failed",
      "Interrupted database restoration failed.",
    );
  }
  collectCleanupFailure(cleanupFailures, () => removeOrphanedRestoreCopies(dbPath));
  throwRestoreCleanupFailures(cleanupFailures);
}
