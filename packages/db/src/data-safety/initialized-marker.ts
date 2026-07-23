import { randomUUID } from "node:crypto";
import { lstatSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import { DATABASE_INITIALIZED_MARKER_SUFFIX } from "@otomat/domain";

import { isUuidV4ArtifactName } from "./artifact-names.js";
import { publishPathDurably } from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import { removeOrphanedDatabaseArtifacts } from "./portable-database.js";

export function databaseMarkerPath(dbPath: string): string {
  return `${dbPath}${DATABASE_INITIALIZED_MARKER_SUFFIX}`;
}

export function databaseMarkerExists(path: string): boolean {
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return false;
  if (stats.isFile() && !stats.isSymbolicLink()) return true;
  throw new DataSafetyError(
    "database_corrupt",
    "The database initialization marker is not a regular file.",
  );
}

export function markDatabaseInitialized(dbPath: string): void {
  const markerPath = databaseMarkerPath(dbPath);
  const temporaryPath = `${markerPath}.${randomUUID()}.partial`;
  try {
    removeOrphanedDatabaseArtifacts(dirname(dbPath), (filename) =>
      isUuidV4ArtifactName(filename, `${basename(markerPath)}.`, ".partial"),
    );
    if (databaseMarkerExists(markerPath)) return;
    writeFileSync(temporaryPath, "", { flag: "wx", mode: 0o600 });
    publishPathDurably(temporaryPath, markerPath);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => rmSync(temporaryPath, { force: true }));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "migration_failed",
      "The database initialization marker could not be published durably.",
    );
  }
}
