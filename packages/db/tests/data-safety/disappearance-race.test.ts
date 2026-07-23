import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const disappearance = vi.hoisted(() => ({
  beforePendingMigration: false,
  beforeInspectionPath: "",
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    lstatSync: (
      path: string,
      options?: Parameters<typeof original.lstatSync>[1],
    ): ReturnType<typeof original.lstatSync> => {
      if (path === disappearance.beforeInspectionPath && options === undefined) {
        disappearance.beforeInspectionPath = "";
        original.rmSync(path);
        const error = new Error(
          "injected disappearance before inspection",
        ) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return original.lstatSync(path, options as never);
    },
  };
});

vi.mock("#db/migrate", async (importOriginal) => {
  const original = await importOriginal<typeof import("#db/migrate")>();
  return {
    ...original,
    runPendingMigrations: (dbPath: string): void => {
      if (disappearance.beforePendingMigration) rmSync(dbPath);
      original.runPendingMigrations(dbPath);
    },
  };
});

import { createClient } from "#db/client";
import { prepareDatabase } from "#db/data-safety/prepare";

let scratch: string | null = null;

afterEach(() => {
  disappearance.beforePendingMigration = false;
  disappearance.beforeInspectionPath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("classifies disappearance during the initial file inspection as missing", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-disappearing-inspection-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  disappearance.beforeInspectionPath = dbPath;

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
});

it("does not recreate a database that disappears between backup and migration", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-disappearing-migration-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const client = createClient(dbPath, { fileMustExist: true });
  client.sqlite.exec(`
    DELETE FROM __drizzle_migrations
    WHERE created_at = (SELECT MAX(created_at) FROM __drizzle_migrations)
  `);
  client.sqlite.close();
  disappearance.beforePendingMigration = true;

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
  expect(() => createClient(dbPath, { fileMustExist: true })).toThrow();
});
