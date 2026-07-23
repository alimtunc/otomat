import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({ backupPath: "" }));

vi.mock("#db/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("#db/client")>();
  return {
    ...original,
    createClient: (...args: Parameters<typeof original.createClient>) => {
      const client = original.createClient(...args);
      if (args[0] === injectedFailure.backupPath && args[1]?.readonly === true) {
        Object.defineProperty(client.sqlite, "backup", {
          value: async (): Promise<never> => {
            throw new Error("injected restore-copy write failure");
          },
        });
      }
      return client;
    },
  };
});

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.backupPath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("reports restore staging I/O as restore failure instead of invalid backup", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-staging-error-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const current = createClient(dbPath, { fileMustExist: true });
  current.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  current.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("backup");
  current.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const changed = createClient(dbPath, { fileMustExist: true });
  changed.sqlite.prepare("UPDATE evidence SET value = ?").run("current");
  changed.sqlite.close();
  injectedFailure.backupPath = backupPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
    backupPath,
  });
  const unchanged = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(unchanged.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("current");
  } finally {
    unchanged.sqlite.close();
  }
});
