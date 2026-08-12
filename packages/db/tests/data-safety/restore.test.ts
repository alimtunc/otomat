import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const diskSpace = vi.hoisted(() => ({ availableBytes: null as number | null }));

vi.mock("#db/data-safety/capacity", async (importOriginal) => {
  const original = await importOriginal<typeof import("#db/data-safety/capacity")>();
  return {
    ...original,
    availableDiskBytes: (...args: Parameters<typeof original.availableDiskBytes>) =>
      diskSpace.availableBytes ?? original.availableDiskBytes(...args),
  };
});

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { removeDatabaseArtifacts } from "#db/data-safety/portable-database";
import { prepareDatabase } from "#db/data-safety/prepare";
import { restoreDatabaseBackup } from "#db/data-safety/restore";
import { TEST_TIMESTAMP, TEST_UUID_V4 } from "#test-support/generated-artifact-names";

let scratch: string | null = null;

afterEach(() => {
  diskSpace.availableBytes = null;
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("replaces the database from a validated backup and preserves the replaced copy", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-"));
  const dbPath = join(scratch, "otomat.db");
  const backupsDir = join(scratch, "backups");
  await prepareDatabase(dbPath);
  const before = createClient(dbPath);
  before.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  before.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("before");
  before.sqlite.close();
  const backupPath = await createConsistentBackup(
    dbPath,
    backupsDir,
    new Date("2026-07-23T10:00:00.000Z"),
  );

  const changed = createClient(dbPath);
  changed.sqlite.prepare("UPDATE evidence SET value = ?").run("after");
  changed.sqlite.close();
  const orphan = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  const orphanSidecar = `${orphan}-wal`;
  const earlierPreservation = join(
    backupsDir,
    `pre-restore-${TEST_TIMESTAMP}-${TEST_UUID_V4}.partial`,
  );
  writeFileSync(orphan, "incomplete");
  writeFileSync(orphanSidecar, "incomplete sidecar");
  mkdirSync(earlierPreservation);
  writeFileSync(join(earlierPreservation, "otomat.db"), "earlier preservation");

  const restored = await restoreDatabaseBackup(dbPath, backupPath);
  expect(readdirSync(scratch).some((name) => name.includes(".restore-"))).toBe(false);
  expect(readdirSync(scratch)).not.toContain(basename(orphan));
  expect(readdirSync(scratch)).not.toContain(basename(orphanSidecar));
  // A preserved database is never deleted automatically, even when its publication was interrupted.
  expect(readFileSync(join(earlierPreservation, "otomat.db"), "utf8")).toBe("earlier preservation");
  expect(readdirSync(backupsDir).filter((name) => name.startsWith(basename(backupPath)))).toEqual([
    basename(backupPath),
  ]);
  const reopened = createClient(dbPath);
  try {
    expect(reopened.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("before");
    expect(restored.preservedPath).toContain("pre-restore-");
    expect(readdirSync(restored.preservedPath)).toContain("otomat.db");
  } finally {
    reopened.sqlite.close();
  }
});

it("restores a missing initialized database without claiming an empty preservation", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-missing-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  removeDatabaseArtifacts(dbPath);

  await expect(restoreDatabaseBackup(dbPath, backupPath)).resolves.toEqual({
    preservedPath: null,
  });
  expect(existsSync(dbPath)).toBe(true);
});

it("reports low disk before moving the current database into preservation", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-capacity-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const valid = createClient(dbPath, { fileMustExist: true });
  valid.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  valid.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  diskSpace.availableBytes = 0;

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "low_disk",
  });
  expect(
    readdirSync(join(scratch, "backups")).some((name) => name.startsWith("pre-restore-")),
  ).toBe(false);
});

it("refuses a backup outside the managed backups directory", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-scope-"));
  const dbPath = join(scratch, "otomat.db");
  const outside = join(scratch, "outside.sqlite");

  await expect(restoreDatabaseBackup(dbPath, outside)).rejects.toMatchObject({
    code: "invalid_backup",
  });
});

it("refuses an unrelated or corrupt file inside the managed backups directory", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-invalid-"));
  const dbPath = join(scratch, "otomat.db");
  const backupsDir = join(scratch, "backups");
  mkdirSync(backupsDir);
  const unrelated = join(backupsDir, "unrelated.sqlite");
  const corrupt = join(backupsDir, `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V4}.sqlite`);
  writeFileSync(unrelated, "not managed");
  writeFileSync(corrupt, "not sqlite");

  await expect(restoreDatabaseBackup(dbPath, unrelated)).rejects.toMatchObject({
    code: "invalid_backup",
  });
  await expect(restoreDatabaseBackup(dbPath, corrupt)).rejects.toMatchObject({
    code: "invalid_backup",
  });
});

it("refuses restore through a symlinked managed backups directory", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-directory-link-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const realBackups = join(scratch, "real-backups");
  mkdirSync(realBackups);
  const candidate = join(realBackups, `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V4}.sqlite`);
  copyFileSync(dbPath, candidate);
  rmSync(join(scratch, "backups"), { recursive: true, force: true });
  symlinkSync(realBackups, join(scratch, "backups"));

  await expect(
    restoreDatabaseBackup(dbPath, join(scratch, "backups", basename(candidate))),
  ).rejects.toMatchObject({ code: "invalid_backup" });
  expect(existsSync(candidate)).toBe(true);
});

it("refuses an incompatible managed backup without changing the current database", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-incompatible-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const current = createClient(dbPath, { fileMustExist: true });
  current.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  current.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("current");
  current.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const incompatible = createClient(backupPath, { fileMustExist: true });
  incompatible.sqlite
    .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
    .run("future", Number.MAX_SAFE_INTEGER);
  incompatible.sqlite.close();

  await expect(restoreDatabaseBackup(dbPath, backupPath)).rejects.toMatchObject({
    code: "schema_incompatible",
  });
  const unchanged = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(unchanged.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("current");
  } finally {
    unchanged.sqlite.close();
  }
});
