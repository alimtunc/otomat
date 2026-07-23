import { schemaMetadataSchema, type SchemaMetadataContract } from "@otomat/domain";
import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

import { migrationsFolder } from "../migrations-folder.js";
import { DataSafetyError } from "./errors.js";

/** Otomat's own migration assets or catalog could not be read; never a user-data fault. */
export class MigrationRuntimeError extends Error {
  constructor(message: string, options: ErrorOptions) {
    super(message, options);
    this.name = "MigrationRuntimeError";
  }
}

export function throwIfMigrationRuntimeFailure(
  primary: unknown,
  secondary: unknown[],
  message: string,
): void {
  if (!(primary instanceof MigrationRuntimeError)) return;
  if (secondary.length === 0) throw primary;
  throw new MigrationRuntimeError(primary.message, {
    cause: new AggregateError([primary, ...secondary], message, { cause: primary }),
  });
}

function migrationTablePresent(sqlite: Database.Database): boolean {
  let objectType: unknown;
  try {
    objectType = sqlite
      .prepare("SELECT type FROM sqlite_master WHERE name = ?")
      .pluck()
      .get("__drizzle_migrations");
  } catch (error) {
    throw new MigrationRuntimeError("The migration catalog could not be read.", {
      cause: error,
    });
  }
  if (objectType === undefined) return false;
  if (objectType !== "table") {
    throw new DataSafetyError(
      "schema_incompatible",
      "The migration history name is occupied by an incompatible database object.",
    );
  }
  let columns: unknown;
  try {
    columns = sqlite.pragma("table_info('__drizzle_migrations')");
  } catch (error) {
    throw new MigrationRuntimeError("The migration table metadata could not be read.", {
      cause: error,
    });
  }
  const columnNames = isUnknownArray(columns)
    ? columns.map((column) =>
        typeof column === "object" &&
        column !== null &&
        "name" in column &&
        typeof column.name === "string"
          ? column.name
          : null,
      )
    : [];
  if (
    columnNames.length === 0 ||
    columnNames.includes(null) ||
    !columnNames.includes("hash") ||
    !columnNames.includes("created_at")
  ) {
    throw new DataSafetyError(
      "schema_incompatible",
      "The database migration table has an incompatible structure.",
    );
  }
  return true;
}

interface AppliedMigration {
  hash: string;
  createdAt: number;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function parseAppliedMigration(row: unknown): AppliedMigration | null {
  if (
    typeof row !== "object" ||
    row === null ||
    !("hash" in row) ||
    typeof row.hash !== "string" ||
    !("created_at" in row) ||
    typeof row.created_at !== "number" ||
    !Number.isFinite(row.created_at)
  ) {
    return null;
  }
  return { hash: row.hash, createdAt: row.created_at };
}

function readAppliedMigrations(sqlite: Database.Database): {
  present: boolean;
  migrations: AppliedMigration[];
} {
  let rows: unknown;
  try {
    if (!migrationTablePresent(sqlite)) return { present: false, migrations: [] };
    rows = sqlite
      .prepare("SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at")
      .all();
  } catch (error) {
    if (error instanceof DataSafetyError || error instanceof MigrationRuntimeError) throw error;
    throw new MigrationRuntimeError("The database migration history could not be read.", {
      cause: error,
    });
  }
  if (!isUnknownArray(rows)) {
    throw new DataSafetyError(
      "schema_incompatible",
      "The database migration history has an invalid structure.",
    );
  }
  const migrations: AppliedMigration[] = [];
  for (const row of rows) {
    const migration = parseAppliedMigration(row);
    if (migration === null) {
      throw new DataSafetyError(
        "schema_incompatible",
        "The database migration history has an invalid structure.",
      );
    }
    const previous = migrations.at(-1);
    if (previous !== undefined && previous.createdAt >= migration.createdAt) {
      throw new DataSafetyError(
        "schema_incompatible",
        "The database migration history contains duplicate or unordered timestamps.",
      );
    }
    migrations.push(migration);
  }
  return { present: true, migrations };
}

export function readSchemaMetadata(sqlite: Database.Database): SchemaMetadataContract {
  const { migrations } = readAppliedMigrations(sqlite);
  return schemaMetadataSchema.parse({
    migration_count: migrations.length,
    latest_migration_at: migrations.at(-1)?.createdAt ?? null,
    page_count: Number(sqlite.pragma("page_count", { simple: true })),
    page_size: Number(sqlite.pragma("page_size", { simple: true })),
  });
}

export function inspectMigrationHistory(sqlite: Database.Database): {
  appliedCount: number;
  present: boolean;
  pending: boolean;
} {
  const { present, migrations: applied } = readAppliedMigrations(sqlite);
  let available: ReturnType<typeof readMigrationFiles>;
  try {
    available = readMigrationFiles({ migrationsFolder });
  } catch (error) {
    throw new MigrationRuntimeError("The bundled database migration assets could not be read.", {
      cause: error,
    });
  }
  const incompatible =
    applied.length > available.length ||
    applied.some((migration, index) => {
      const expected = available[index];
      return (
        expected === undefined ||
        migration.createdAt !== expected.folderMillis ||
        migration.hash !== expected.hash
      );
    });
  if (incompatible) {
    throw new DataSafetyError(
      "schema_incompatible",
      "The database migration history is newer than or incompatible with this Otomat build.",
    );
  }
  return { appliedCount: applied.length, present, pending: applied.length < available.length };
}
