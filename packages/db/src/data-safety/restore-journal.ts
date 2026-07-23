import { randomUUID } from "node:crypto";
import { lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { publishPathDurably, replacePathDurably, syncManagedPath } from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import { isRestoreTemporaryName } from "./restore-paths.js";

interface RestoreJournal {
  version: 1;
  temporaryName: string;
  temporaryDevice: string;
  temporaryInode: string;
}

export interface RestoreJournalState {
  temporaryPath: string;
  temporaryDevice: string;
  temporaryInode: string;
}

export function restoreJournalPath(dbPath: string): string {
  return `${dbPath}.restore-journal`;
}

function parseRestoreJournal(dbPath: string, serialized: string): RestoreJournal {
  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch (error) {
    throw new DataSafetyError("restore_failed", "The restore journal is not valid JSON.", {
      cause: error,
    });
  }
  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("version" in decoded) ||
    decoded.version !== 1 ||
    !("temporaryName" in decoded) ||
    typeof decoded.temporaryName !== "string" ||
    basename(decoded.temporaryName) !== decoded.temporaryName ||
    !isRestoreTemporaryName(dbPath, decoded.temporaryName) ||
    !("temporaryDevice" in decoded) ||
    typeof decoded.temporaryDevice !== "string" ||
    !/^\d+$/.test(decoded.temporaryDevice) ||
    !("temporaryInode" in decoded) ||
    typeof decoded.temporaryInode !== "string" ||
    !/^\d+$/.test(decoded.temporaryInode)
  ) {
    throw new DataSafetyError("restore_failed", "The restore journal has an invalid structure.");
  }
  return {
    version: 1,
    temporaryName: decoded.temporaryName,
    temporaryDevice: decoded.temporaryDevice,
    temporaryInode: decoded.temporaryInode,
  };
}

export function writeRestoreJournal(
  dbPath: string,
  temporaryPath: string,
  publication: "create" | "replace" = "create",
): void {
  const path = restoreJournalPath(dbPath);
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats !== undefined && publication === "create") {
    throw new DataSafetyError("restore_failed", "A previous restore journal already exists.");
  }
  const partialPath = `${path}.${randomUUID()}.partial`;
  try {
    const temporaryStats = lstatSync(temporaryPath, { bigint: true });
    if (!temporaryStats.isFile() || temporaryStats.isSymbolicLink()) {
      throw new DataSafetyError(
        "restore_failed",
        "The staged restore copy is not a regular managed file.",
      );
    }
    writeFileSync(
      partialPath,
      `${JSON.stringify({
        version: 1,
        temporaryName: basename(temporaryPath),
        temporaryDevice: String(temporaryStats.dev),
        temporaryInode: String(temporaryStats.ino),
      })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    if (publication === "replace") replacePathDurably(partialPath, path);
    else publishPathDurably(partialPath, path);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => rmSync(partialPath, { force: true }));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "restore_failed",
      "The restore journal could not be written safely.",
    );
  }
}

export function removeRestoreJournal(dbPath: string): void {
  rmSync(restoreJournalPath(dbPath), { force: true });
  syncManagedPath(dirname(dbPath));
}

export function readRestoreJournal(dbPath: string): RestoreJournalState | null {
  const path = restoreJournalPath(dbPath);
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return null;
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new DataSafetyError(
      "restore_failed",
      "The restore journal is not a regular managed file.",
    );
  }
  const journal = parseRestoreJournal(dbPath, readFileSync(path, "utf8"));
  return {
    temporaryPath: join(dirname(dbPath), journal.temporaryName),
    temporaryDevice: journal.temporaryDevice,
    temporaryInode: journal.temporaryInode,
  };
}
