import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import {
  assertSufficientDiskSpace,
  databaseBytes,
  requiredPreMigrationBytes,
  requiredRestoreBytes,
} from "#db/data-safety/capacity";
import { DataSafetyError, preserveDataSafetyFailure } from "#db/data-safety/errors";
import { readSchemaMetadata } from "#db/data-safety/metadata";
import { prepareDatabase } from "#db/data-safety/prepare";
import { TEST_UUID_V4, TEST_UUID_V5 } from "#test-support/generated-artifact-names";

let scratch: string | null = null;

afterEach(() => {
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("adds a known backup path to a recoverable failure without cleanup failures", () => {
  const backupPath = "/managed/backups/otomat-backup.sqlite";
  const failure = preserveDataSafetyFailure(
    new DataSafetyError("restore_failed", "Journal write failed."),
    [],
    "restore_failed",
    "Restore failed.",
    { backupPath },
  );

  expect(failure).toMatchObject({ code: "restore_failed", backupPath });
});

it("reports corruption without deleting or recreating the database", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-corrupt-db-"));
  const dbPath = join(scratch, "otomat.db");
  const corruptBytes = Buffer.from("this is not sqlite");
  writeFileSync(dbPath, corruptBytes);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({
    code: "database_corrupt",
    backupPath: null,
  });
  expect(readFileSync(dbPath)).toEqual(corruptBytes);
});

it("allows the first migration to create a missing database parent directory", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-first-run-parent-"));
  const dbPath = join(scratch, "nested", "otomat.db");

  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(dbPath)).toBe(true);
  expect(existsSync(`${dbPath}.initialized`)).toBe(true);
});

it("removes only generated initial database copies before first migration", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-initial-cleanup-"));
  const dbPath = join(scratch, "otomat.db");
  const interrupted = `${dbPath}.initialize-${TEST_UUID_V4}.partial`;
  const nearMatch = `${dbPath}.initialize-${TEST_UUID_V5}.partial`;
  writeFileSync(interrupted, "remove");
  writeFileSync(`${interrupted}-wal`, "remove");
  writeFileSync(nearMatch, "preserve");

  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(interrupted)).toBe(false);
  expect(existsSync(`${interrupted}-wal`)).toBe(false);
  expect(readFileSync(nearMatch, "utf8")).toBe("preserve");
});

it("removes only orphaned initialization-marker partials during startup", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-marker-cleanup-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const orphanMarker = `${dbPath}.initialized.${TEST_UUID_V4}.partial`;
  const nearMarker = `${dbPath}.initialized.${TEST_UUID_V5}.partial`;
  const unrelated = join(scratch, "unrelated.partial");
  writeFileSync(orphanMarker, "");
  writeFileSync(nearMarker, "keep");
  writeFileSync(unrelated, "keep");

  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(orphanMarker)).toBe(false);
  expect(readFileSync(nearMarker, "utf8")).toBe("keep");
  expect(existsSync(unrelated)).toBe(true);
});

it("cleans restore copies left before journal publication during startup", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-pre-journal-crash-"));
  const dbPath = join(scratch, "otomat.db");
  const restoreCopy = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  const journalPartial = `${dbPath}.restore-journal.${TEST_UUID_V4}.partial`;
  const nearRestoreCopy = `${dbPath}.restore-${TEST_UUID_V5}.partial`;
  const nearJournalPartial = `${dbPath}.restore-journal.${TEST_UUID_V5}.partial`;
  writeFileSync(restoreCopy, "unfinished restore copy");
  writeFileSync(`${restoreCopy}-wal`, "unfinished sidecar");
  writeFileSync(journalPartial, "unfinished journal");
  writeFileSync(nearRestoreCopy, "preserve");
  writeFileSync(nearJournalPartial, "preserve");

  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(restoreCopy)).toBe(false);
  expect(existsSync(`${restoreCopy}-wal`)).toBe(false);
  expect(existsSync(journalPartial)).toBe(false);
  expect(readFileSync(nearRestoreCopy, "utf8")).toBe("preserve");
  expect(readFileSync(nearJournalPartial, "utf8")).toBe("preserve");
});

it("treats an existing empty database as damaged instead of initializing over it", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-empty-db-"));
  const dbPath = join(scratch, "otomat.db");
  writeFileSync(dbPath, "");

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({
    code: "database_corrupt",
    backupPath: null,
  });
  expect(readFileSync(dbPath)).toHaveLength(0);
});

it("reports available and required bytes when disk space is insufficient", () => {
  expect(() => assertSufficientDiskSpace(1024, 4096)).toThrow(
    expect.objectContaining<DataSafetyError>({
      code: "low_disk",
      availableBytes: 1024,
      requiredBytes: 4096,
    }),
  );
});

it("reserves enough restore capacity for a missing database and pending migrations", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-capacity-formula-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backup = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    const databaseSize = databaseBytes(backup.sqlite);
    expect(requiredPreMigrationBytes(backup.sqlite)).toBe(3 * databaseSize + 16 * 1024 * 1024);
    expect(requiredRestoreBytes(backup.sqlite, 0, true)).toBe(
      databaseSize + requiredPreMigrationBytes(backup.sqlite),
    );
    expect(requiredRestoreBytes(backup.sqlite, 0, false)).toBe(databaseBytes(backup.sqlite));
  } finally {
    backup.sqlite.close();
  }
});

it("does not recreate a database that disappeared after successful initialization", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-missing-db-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  expect(existsSync(`${dbPath}.initialized`)).toBe(true);
  rmSync(dbPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
  expect(existsSync(dbPath)).toBe(false);
});

it("rejects dangling database and marker symlinks without creating their targets", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-dangling-database-"));
  const dbPath = join(scratch, "otomat.db");
  const missingDatabaseTarget = join(scratch, "outside.db");
  symlinkSync(missingDatabaseTarget, dbPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_corrupt" });
  expect(existsSync(missingDatabaseTarget)).toBe(false);

  rmSync(dbPath);
  const missingMarkerTarget = join(scratch, "outside.marker");
  symlinkSync(missingMarkerTarget, `${dbPath}.initialized`);
  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_corrupt" });
  expect(existsSync(missingMarkerTarget)).toBe(false);
});

it("rejects a migration history from an incompatible schema without writing", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-future-schema-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const client = createClient(dbPath);
  client.sqlite
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run("future", Number.MAX_SAFE_INTEGER);
  client.sqlite.close();

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "schema_incompatible" });
});

it("rejects duplicate migration timestamps instead of relying on nullable row ids", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-duplicate-migration-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const client = createClient(dbPath);
  const latestMigrationAt = readSchemaMetadata(client.sqlite).latest_migration_at;
  if (latestMigrationAt === null) throw new Error("Expected the initialized migration history");
  client.sqlite
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run("duplicate", latestMigrationAt);
  client.sqlite.close();

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "schema_incompatible" });
});

it("classifies an incompatible migration-table shape as a schema failure", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-migration-table-shape-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const client = createClient(dbPath);
  client.sqlite.exec(`
    DROP TABLE __drizzle_migrations;
    CREATE TABLE __drizzle_migrations (unexpected TEXT NOT NULL);
  `);
  client.sqlite.close();

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({
    code: "schema_incompatible",
  });
});

it("rejects a non-table object occupying the migration-history name before backup", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-migration-view-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const client = createClient(dbPath);
  client.sqlite.exec(`
    DROP TABLE __drizzle_migrations;
    CREATE VIEW __drizzle_migrations AS SELECT 'unexpected' AS hash, 1 AS created_at;
  `);
  client.sqlite.close();

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({
    code: "schema_incompatible",
  });
  expect(existsSync(join(scratch, "backups"))).toBe(false);
});

it("rejects a foreign SQLite database without adopting it as Otomat state", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-foreign-sqlite-"));
  const dbPath = join(scratch, "otomat.db");
  const client = createClient(dbPath);
  client.sqlite.exec("CREATE TABLE foreign_records (value TEXT NOT NULL)");
  client.sqlite.close();

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({
    code: "schema_incompatible",
  });
  const unchanged = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(
      unchanged.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .pluck()
        .all(),
    ).toEqual(["foreign_records"]);
  } finally {
    unchanged.sqlite.close();
  }
  expect(existsSync(join(scratch, "backups"))).toBe(false);
});
