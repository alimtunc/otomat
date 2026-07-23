import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({
  directory: "",
  directorySyncCalls: 0,
  descriptor: null as number | null,
  failDirectorySyncAt: null as number | null,
  failEveryDirectorySync: false,
  failRestoreCopy: false,
  installDestination: "",
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
      if (descriptor === injectedFailure.descriptor) {
        injectedFailure.directorySyncCalls += 1;
        if (
          injectedFailure.failEveryDirectorySync ||
          injectedFailure.directorySyncCalls === injectedFailure.failDirectorySyncAt
        ) {
          throw new Error("injected directory synchronization failure");
        }
      }
      if (injectedFailure.failRestoreCopy && descriptor === injectedFailure.restoreCopyDescriptor) {
        throw new Error("injected restore-copy synchronization failure");
      }
      original.fsyncSync(descriptor);
    },
    openSync: (path: string, flags: string | number, mode?: number): number => {
      const descriptor = original.openSync(path, flags, mode);
      if (path === injectedFailure.directory) injectedFailure.descriptor = descriptor;
      if (
        path.includes(".restore-") &&
        !path.includes(".restore-journal") &&
        path.endsWith(".partial")
      ) {
        injectedFailure.restoreCopyDescriptor = descriptor;
      }
      return descriptor;
    },
    renameSync: (source: string, destination: string): void => {
      if (destination === injectedFailure.installDestination) {
        throw new Error("injected restore installation failure");
      }
      original.renameSync(source, destination);
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
  injectedFailure.directorySyncCalls = 0;
  injectedFailure.descriptor = null;
  injectedFailure.failDirectorySyncAt = null;
  injectedFailure.failEveryDirectorySync = false;
  injectedFailure.failRestoreCopy = false;
  injectedFailure.installDestination = "";
  injectedFailure.restoreCopyDescriptor = null;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("does not remove current sidecars when restore-journal publication is not durable", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-journal-durability-"));
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
  expect(readFileSync(walPath, "utf8")).toBe("current wal");
  expect(readFileSync(shmPath, "utf8")).toBe("current shm");
});

it("retains the staged restore when journal cleanup is not durable", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-rollback-durability-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  writeFileSync(walPath, "current wal");
  writeFileSync(shmPath, "current shm");
  injectedFailure.directory = scratch;
  injectedFailure.failDirectorySyncAt = 2;
  injectedFailure.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(readFileSync(walPath, "utf8")).toBe("current wal");
  expect(readFileSync(shmPath, "utf8")).toBe("current shm");
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  expect(readdirSync(scratch).some((name) => name.startsWith("otomat.db.restore-"))).toBe(true);
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

it("synchronizes the restore copy before removing current sidecars", async () => {
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
  expect(readFileSync(walPath, "utf8")).toBe("current wal");
  expect(readFileSync(shmPath, "utf8")).toBe("current shm");
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

it("recognizes an installed restore by inode and removes old sidecars on recovery", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-post-rename-recovery-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  writeFileSync(`${dbPath}-wal`, "old wal");
  writeFileSync(`${dbPath}-shm`, "old shm");
  injectedFailure.directory = scratch;
  injectedFailure.failDirectorySyncAt = 2;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(true);
  expect(existsSync(`${dbPath}-wal`)).toBe(true);

  injectedFailure.failDirectorySyncAt = null;
  injectedFailure.directorySyncCalls = 0;
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  if (existsSync(`${dbPath}-wal`)) {
    expect(readFileSync(`${dbPath}-wal`, "utf8")).not.toBe("old wal");
  }
  if (existsSync(`${dbPath}-shm`)) {
    expect(readFileSync(`${dbPath}-shm`, "utf8")).not.toBe("old shm");
  }
});
