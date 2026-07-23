import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  closePath: "",
  openPath: "",
}));

vi.mock("#db/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("#db/client")>();
  return {
    ...original,
    createClient: (...args: Parameters<typeof original.createClient>) => {
      const [path] = args;
      if (path === injectedFailure.openPath) {
        throw new Error("injected SQLite open resource failure");
      }
      const client = original.createClient(...args);
      if (path === injectedFailure.closePath) {
        const close = client.sqlite.close.bind(client.sqlite);
        Object.defineProperty(client.sqlite, "close", {
          value: () => {
            close();
            throw new Error("injected SQLite close resource failure");
          },
        });
      }
      return client;
    },
  };
});

import { createConsistentBackup } from "#db/data-safety/backup";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.closePath = "";
  injectedFailure.openPath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("does not diagnose a current-database open resource failure as corruption", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-current-open-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  injectedFailure.openPath = dbPath;

  let failure: unknown;
  try {
    await prepareDatabase(dbPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).not.toMatchObject({ code: "database_corrupt" });
});

it("does not diagnose current-database handle cleanup failure as corruption", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-current-close-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  injectedFailure.closePath = dbPath;

  let failure: unknown;
  try {
    await prepareDatabase(dbPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).not.toMatchObject({ code: "database_corrupt" });
});

it("does not reject a valid backup permanently for an open resource failure", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-open-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  injectedFailure.openPath = backupPath;

  let failure: unknown;
  try {
    await restoreDatabaseBackup(dbPath, backupPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).not.toMatchObject({ code: "invalid_backup" });
});

it("does not reject a valid backup permanently when handle cleanup fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-close-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  injectedFailure.closePath = backupPath;

  let failure: unknown;
  try {
    await restoreDatabaseBackup(dbPath, backupPath);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(failure).not.toMatchObject({ code: "invalid_backup" });
});
