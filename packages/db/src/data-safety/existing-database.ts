import { lstatSync } from "node:fs";

import { createClient, type DbClient } from "../client.js";
import {
  collectCleanupFailure,
  DataSafetyError,
  inspectPathAfterFailure,
  isSqliteContentError,
  preserveClassifiedFailure,
  throwIfUnclassifiedFailure,
} from "./errors.js";
import { assertDatabaseIntegrity } from "./integrity.js";
import { inspectMigrationHistory, throwIfMigrationRuntimeFailure } from "./metadata.js";

export function inspectExistingDatabase(dbPath: string): { pending: boolean } {
  let stats;
  try {
    stats = lstatSync(dbPath);
  } catch (error) {
    const inspection = inspectPathAfterFailure(dbPath, error);
    if (inspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before it could be inspected.",
        { cause: inspection.cause },
      );
    }
    throw inspection.cause;
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size === 0) {
    throw new DataSafetyError(
      "database_corrupt",
      "The existing database is not a non-empty regular file.",
    );
  }
  let client: DbClient;
  try {
    client = createClient(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    if (isSqliteContentError(error)) {
      throw new DataSafetyError(
        "database_corrupt",
        "The existing file is not a valid SQLite database.",
        { cause: error },
      );
    }
    const inspection = inspectPathAfterFailure(dbPath, error);
    if (inspection.missing) {
      throw new DataSafetyError(
        "database_missing",
        "The initialized database disappeared before it could be inspected.",
        { cause: inspection.cause },
      );
    }
    throw inspection.cause;
  }
  const failures: unknown[] = [];
  let pending = false;
  try {
    assertDatabaseIntegrity(client.sqlite, "database_corrupt", "Database");
    const migrationHistory = inspectMigrationHistory(client.sqlite);
    if (!migrationHistory.present) {
      throw new DataSafetyError(
        "schema_incompatible",
        "The existing database has no Otomat migration history.",
      );
    }
    pending = migrationHistory.pending;
  } catch (error) {
    failures.push(error);
  }
  collectCleanupFailure(failures, () => client.sqlite.close());
  if (failures.length > 0) {
    const [primary, ...secondary] = failures;
    const classifiedPrimary = isSqliteContentError(primary)
      ? new DataSafetyError(
          "database_corrupt",
          "The existing SQLite database is structurally corrupt.",
          { cause: primary },
        )
      : primary;
    throwIfMigrationRuntimeFailure(
      classifiedPrimary,
      secondary,
      "Database migration metadata and handle cleanup both failed.",
    );
    throwIfUnclassifiedFailure(
      classifiedPrimary,
      secondary,
      "Database inspection and handle cleanup both failed.",
    );
    throw preserveClassifiedFailure(classifiedPrimary, secondary);
  }
  return { pending };
}
