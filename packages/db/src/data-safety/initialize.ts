import { randomUUID } from "node:crypto";
import { chmodSync, lstatSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { runMigrations } from "../migrate.js";
import { isUuidV4ArtifactName } from "./artifact-names.js";
import { publishNewPathDurably } from "./durable-publication.js";
import { collectCleanupFailure, DataSafetyError, preserveDataSafetyFailure } from "./errors.js";
import {
  finalizePortableDatabase,
  removeDatabaseArtifacts,
  removeOrphanedDatabaseArtifacts,
} from "./portable-database.js";

const INITIAL_DATABASE_SUFFIX = ".partial";

function initialDatabasePrefix(dbPath: string): string {
  return `${basename(dbPath)}.initialize-`;
}

export function cleanupInterruptedInitializations(dbPath: string): void {
  const databaseDirectory = dirname(dbPath);
  if (lstatSync(databaseDirectory, { throwIfNoEntry: false }) === undefined) return;
  try {
    removeOrphanedDatabaseArtifacts(databaseDirectory, (filename) =>
      isUuidV4ArtifactName(filename, initialDatabasePrefix(dbPath), INITIAL_DATABASE_SUFFIX),
    );
  } catch (error) {
    throw new DataSafetyError(
      "migration_failed",
      "Interrupted initial database copies could not be cleaned safely.",
      { cause: error },
    );
  }
}

export function initializeDatabase(dbPath: string): void {
  const temporaryPath = join(
    dirname(dbPath),
    `${initialDatabasePrefix(dbPath)}${randomUUID()}${INITIAL_DATABASE_SUFFIX}`,
  );
  try {
    runMigrations(temporaryPath);
    try {
      finalizePortableDatabase(temporaryPath, "Initial database");
    } catch (error) {
      throw new DataSafetyError(
        "migration_failed",
        "The initial database could not be finalized safely.",
        { cause: error },
      );
    }
    chmodSync(temporaryPath, 0o600);
    publishNewPathDurably(temporaryPath, dbPath);
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    collectCleanupFailure(cleanupFailures, () => removeDatabaseArtifacts(temporaryPath));
    throw preserveDataSafetyFailure(
      error,
      cleanupFailures,
      "migration_failed",
      "Initial database migration failed. Otomat did not publish a partial database.",
    );
  }
}
