import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  initialFinalization: false,
  migrationAssets: false,
}));

vi.mock("drizzle-orm/better-sqlite3/migrator", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm/better-sqlite3/migrator")>();
  return {
    ...original,
    migrate: (...args: Parameters<typeof original.migrate>) => {
      if (injectedFailure.migrationAssets) {
        throw new Error("injected migration-assets failure");
      }
      return original.migrate(...args);
    },
  };
});

vi.mock("drizzle-orm/migrator", async (importOriginal) => {
  const original = await importOriginal<typeof import("drizzle-orm/migrator")>();
  return {
    ...original,
    readMigrationFiles: (...args: Parameters<typeof original.readMigrationFiles>) => {
      if (injectedFailure.migrationAssets) {
        throw new Error("injected migration-assets failure");
      }
      return original.readMigrationFiles(...args);
    },
  };
});

vi.mock("#db/data-safety/portable-database", async (importOriginal) => {
  const original = await importOriginal<typeof import("#db/data-safety/portable-database")>();
  return {
    ...original,
    finalizePortableDatabase: (...args: Parameters<typeof original.finalizePortableDatabase>) => {
      if (injectedFailure.initialFinalization && args[1] === "Initial database") {
        throw new Error("injected initial-finalization failure");
      }
      return original.finalizePortableDatabase(...args);
    },
  };
});

import { createConsistentBackup } from "#db/data-safety/backup";
import { MigrationAssetsReadError } from "#db/data-safety/metadata";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.initialFinalization = false;
  injectedFailure.migrationAssets = false;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("does not diagnose user database corruption when bundled migration assets fail", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-migration-assets-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  injectedFailure.migrationAssets = true;

  let failure: unknown;
  try {
    await prepareDatabase(dbPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).not.toMatchObject({ code: "database_corrupt" });
});

it("retries first initialization after migration assets fail without publishing a partial DB", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-initial-assets-"));
  const dbPath = join(scratch, "otomat.db");
  injectedFailure.migrationAssets = true;

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "migration_failed" });
  expect(existsSync(dbPath)).toBe(false);
  expect(existsSync(`${dbPath}.initialized`)).toBe(false);

  injectedFailure.migrationAssets = false;
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(dbPath)).toBe(true);
  expect(existsSync(`${dbPath}.initialized`)).toBe(true);
});

it("reports initial database finalization as a retryable migration failure", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-initial-finalization-"));
  const dbPath = join(scratch, "otomat.db");
  injectedFailure.initialFinalization = true;

  let failure: unknown;
  try {
    await prepareDatabase(dbPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({
    cause: expect.objectContaining({ message: "injected initial-finalization failure" }),
    code: "migration_failed",
  });
  expect(existsSync(dbPath)).toBe(false);
  expect(existsSync(`${dbPath}.initialized`)).toBe(false);
  expect(readdirSync(scratch).every((name) => !name.includes(".initialize-"))).toBe(true);

  injectedFailure.initialFinalization = false;
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(dbPath)).toBe(true);
  expect(existsSync(`${dbPath}.initialized`)).toBe(true);
});

it("does not present migration-assets failure as a repeatable restore action", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-assets-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  injectedFailure.migrationAssets = true;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toBeInstanceOf(
    MigrationAssetsReadError,
  );
});
