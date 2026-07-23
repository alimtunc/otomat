import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const renameFailure = vi.hoisted(() => ({
  failPreservationCopy: false,
  installDestination: "",
  journalRemovalPath: "",
  rollbackDestination: "",
}));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    copyFileSync: (from: string, to: string): void => {
      if (
        to === renameFailure.rollbackDestination ||
        (renameFailure.failPreservationCopy && to.includes("pre-restore-"))
      ) {
        throw new Error(`injected copy failure for ${to}`);
      }
      original.copyFileSync(from, to);
    },
    renameSync: (from: string, to: string): void => {
      if (to === renameFailure.installDestination || to === renameFailure.rollbackDestination) {
        throw new Error(`injected rename failure for ${to}`);
      }
      original.renameSync(from, to);
    },
    rmSync: (...args: Parameters<typeof original.rmSync>): void => {
      if (args[0] === renameFailure.journalRemovalPath) {
        throw new Error(`injected journal removal failure for ${String(args[0])}`);
      }
      original.rmSync(...args);
    },
  };
});

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

afterEach(() => {
  renameFailure.failPreservationCopy = false;
  renameFailure.installDestination = "";
  renameFailure.journalRemovalPath = "";
  renameFailure.rollbackDestination = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("removes the staged restore copy when current-state preservation fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-preservation-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  renameFailure.failPreservationCopy = true;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  expect(readdirSync(scratch).some((name) => name.startsWith("otomat.db.restore-"))).toBe(false);
});

it("retains the restore copy when rollback cannot remove its journal", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-journal-rollback-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  renameFailure.installDestination = dbPath;
  renameFailure.journalRemovalPath = `${dbPath}.restore-journal`;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(true);
  expect(readdirSync(scratch).some((name) => name.startsWith("otomat.db.restore-"))).toBe(true);
});

it("keeps the canonical database when atomic restore installation fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-rollback-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("preserved");
  live.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  renameFailure.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(dbPath)).toBe(true);
  const reopened = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(reopened.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("preserved");
  } finally {
    reopened.sqlite.close();
  }
  expect(readdirSync(scratch).some((name) => name.includes(".restore-"))).toBe(false);
});

it("leaves current sidecars untouched when atomic installation fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-rollback-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  writeFileSync(walPath, "preserve this sidecar");
  writeFileSync(shmPath, "restore this sidecar");
  renameFailure.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(existsSync(dbPath)).toBe(true);
  const preservedDirectory = readdirSync(join(scratch, "backups")).find((name) =>
    name.startsWith("pre-restore-"),
  );
  if (preservedDirectory === undefined) throw new Error("Restore did not preserve its sidecar");
  expect(readFileSync(join(scratch, "backups", preservedDirectory, "otomat.db-wal"), "utf8")).toBe(
    "preserve this sidecar",
  );
  expect(readFileSync(walPath, "utf8")).toBe("preserve this sidecar");
  expect(readFileSync(shmPath, "utf8")).toBe("restore this sidecar");
});

it("keeps a recovery journal when explicit ambiguous-state installation fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-ambiguous-install-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const originalBytes = readFileSync(dbPath);
  writeFileSync(`${dbPath}-wal`, "ambiguous wal");
  writeFileSync(`${dbPath}.restore-journal`, "unreadable journal");
  renameFailure.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  expect(readFileSync(dbPath)).toEqual(originalBytes);
  expect(readFileSync(`${dbPath}-wal`, "utf8")).toBe("ambiguous wal");
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(true);
  expect(readdirSync(scratch).some((name) => name.startsWith("otomat.db.restore-"))).toBe(true);

  renameFailure.installDestination = "";
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
});
