import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injected = vi.hoisted(() => ({ preservationTarget: "", installDestination: "" }));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    renameSync: (from: string, to: string): void => {
      if (
        to === injected.installDestination ||
        (injected.preservationTarget !== "" &&
          to.includes("pre-restore-") &&
          to.endsWith(injected.preservationTarget))
      ) {
        throw new Error(`injected rename failure for ${to}`);
      }
      original.renameSync(from, to);
    },
  };
});

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";

let scratch: string | null = null;

function preservedDirectory(root: string): string {
  const name = readdirSync(join(root, "backups")).find((entry) => entry.startsWith("pre-restore-"));
  if (name === undefined) throw new Error("Restore did not preserve the current database");
  return join(root, "backups", name);
}

function stagedRestoreCopies(root: string): string[] {
  return readdirSync(root).filter((name) => name.startsWith("otomat.db.restore-"));
}

afterEach(() => {
  injected.preservationTarget = "";
  injected.installDestination = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("returns the current database to its place when preservation fails part-way", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-preservation-failure-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("preserved");
  live.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  injected.preservationTarget = "otomat.db-wal";

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  const reopened = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(reopened.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("preserved");
  } finally {
    reopened.sqlite.close();
  }
  expect(stagedRestoreCopies(scratch)).toEqual([]);
  expect(readdirSync(join(scratch, "backups")).some((name) => name.includes("pre-restore-"))).toBe(
    false,
  );
});

it("keeps the whole current database in the backups directory when installation fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-rollback-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("preserved");
  live.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  injected.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
    backupPath,
  });
  const preserved = createClient(join(preservedDirectory(scratch), "otomat.db"), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    expect(preserved.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("preserved");
  } finally {
    preserved.sqlite.close();
  }
  expect(stagedRestoreCopies(scratch)).toEqual([]);
});

it("reports the interrupted restore as a missing database instead of a silent reset", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-interrupted-install-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const originalBytes = readFileSync(dbPath);
  injected.installDestination = dbPath;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "restore_failed",
  });
  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
  expect(readFileSync(join(preservedDirectory(scratch), "otomat.db"))).toEqual(originalBytes);

  injected.installDestination = "";
  await expect(restoreDatabaseBackup(dbPath, backupPath)).resolves.toMatchObject({
    preservedPath: null,
  });
  expect(existsSync(dbPath)).toBe(true);
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
});
