import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  directory: "",
  descriptor: null as number | null,
  failEveryDirectorySync: false,
  failRestoreCopy: false,
  restoreCopyDescriptor: null as number | null,
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    closeSync: (descriptor: number): void => {
      try {
        original.closeSync(descriptor);
      } finally {
        if (descriptor === injectedFailure.descriptor) injectedFailure.descriptor = null;
        if (descriptor === injectedFailure.restoreCopyDescriptor) {
          injectedFailure.restoreCopyDescriptor = null;
        }
      }
    },
    fsyncSync: (descriptor: number): void => {
      if (descriptor === injectedFailure.descriptor && injectedFailure.failEveryDirectorySync) {
        throw new Error("injected directory synchronization failure");
      }
      if (injectedFailure.failRestoreCopy && descriptor === injectedFailure.restoreCopyDescriptor) {
        throw new Error("injected restore-copy synchronization failure");
      }
      original.fsyncSync(descriptor);
    },
    openSync: (path: string, flags: string | number, mode?: number): number => {
      const descriptor = original.openSync(path, flags, mode);
      if (path === injectedFailure.directory) injectedFailure.descriptor = descriptor;
      if (path.includes(".restore-") && path.endsWith(".partial")) {
        injectedFailure.restoreCopyDescriptor = descriptor;
      }
      return descriptor;
    },
  };
});

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.directory = "";
  injectedFailure.descriptor = null;
  injectedFailure.failEveryDirectorySync = false;
  injectedFailure.failRestoreCopy = false;
  injectedFailure.restoreCopyDescriptor = null;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("returns the current database and its sidecars when preservation is not durable", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-preservation-durability-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const current = createClient(dbPath, { fileMustExist: true });
  current.sqlite.close();
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  writeFileSync(walPath, "current wal");
  writeFileSync(shmPath, "current shm");
  injectedFailure.directory = scratch;
  injectedFailure.failEveryDirectorySync = true;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(dbPath)).toBe(true);
  expect(readFileSync(walPath, "utf8")).toBe("current wal");
  expect(readFileSync(shmPath, "utf8")).toBe("current shm");
});

it("does not declare initialization successful when marker publication is not durable", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-marker-durability-"));
  const dbPath = join(scratch, "otomat.db");
  injectedFailure.directory = scratch;
  injectedFailure.failEveryDirectorySync = true;

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "migration_failed" });
  expect(existsSync(`${dbPath}.initialized`)).toBe(false);
  expect(readdirSync(scratch).every((name) => !name.includes(".initialized."))).toBe(true);

  injectedFailure.failEveryDirectorySync = false;
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(`${dbPath}.initialized`)).toBe(true);
});

it("synchronizes the restore copy before moving the current database aside", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-copy-durability-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  writeFileSync(walPath, "current wal");
  writeFileSync(shmPath, "current shm");
  injectedFailure.failRestoreCopy = true;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(dbPath)).toBe(true);
  expect(readFileSync(walPath, "utf8")).toBe("current wal");
  expect(readFileSync(shmPath, "utf8")).toBe("current shm");
  expect(readdirSync(join(scratch, "backups")).some((name) => name.includes("pre-restore-"))).toBe(
    false,
  );
});

it("fails backup creation when a new backups directory is not durable", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-directory-durability-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  injectedFailure.directory = scratch;
  injectedFailure.failEveryDirectorySync = true;

  await expect(createConsistentBackup(dbPath, join(scratch, "backups"))).rejects.toMatchObject({
    code: "backup_failed",
  });
  expect(readdirSync(join(scratch, "backups"))).toEqual([]);
});
