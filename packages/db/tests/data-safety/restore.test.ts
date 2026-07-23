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
import { writeRestoreJournal } from "#db/data-safety/restore-journal";
import {
  TEST_INVALID_TIMESTAMP,
  TEST_TIMESTAMP,
  TEST_UUID_V4,
  TEST_UUID_V4_ALTERNATE,
  TEST_UUID_V5,
} from "#test-support/generated-artifact-names";

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
  const orphanPreservation = join(
    backupsDir,
    `pre-restore-${TEST_TIMESTAMP}-${TEST_UUID_V4}.partial`,
  );
  const orphanPreservationLink = join(
    backupsDir,
    `pre-restore-${TEST_TIMESTAMP}-${TEST_UUID_V4_ALTERNATE}.partial`,
  );
  const preservationTarget = join(scratch, "preservation-target");
  const nearPreservation = join(
    backupsDir,
    `pre-restore-${TEST_TIMESTAMP}-${TEST_UUID_V5}.partial`,
  );
  const impossiblePreservation = join(
    backupsDir,
    `pre-restore-${TEST_INVALID_TIMESTAMP}-${TEST_UUID_V4}.partial`,
  );
  writeFileSync(orphan, "incomplete");
  writeFileSync(orphanSidecar, "incomplete sidecar");
  mkdirSync(orphanPreservation);
  writeFileSync(join(orphanPreservation, "otomat.db"), "incomplete preservation");
  mkdirSync(preservationTarget);
  writeFileSync(join(preservationTarget, "sentinel"), "preserve");
  symlinkSync(preservationTarget, orphanPreservationLink);
  mkdirSync(nearPreservation);
  mkdirSync(impossiblePreservation);

  const restored = await restoreDatabaseBackup(dbPath, backupPath);
  expect(readdirSync(scratch).some((name) => name.includes(".restore-"))).toBe(false);
  expect(readdirSync(scratch)).not.toContain(basename(orphan));
  expect(readdirSync(scratch)).not.toContain(basename(orphanSidecar));
  expect(existsSync(orphanPreservation)).toBe(false);
  expect(existsSync(orphanPreservationLink)).toBe(false);
  expect(readFileSync(join(preservationTarget, "sentinel"), "utf8")).toBe("preserve");
  expect(existsSync(nearPreservation)).toBe(true);
  expect(existsSync(impossiblePreservation)).toBe(true);
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

it("finishes a journaled restore before inspecting a database at startup", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-recovery-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath);
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("backup");
  live.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));

  const changed = createClient(dbPath);
  changed.sqlite.prepare("UPDATE evidence SET value = ?").run("current");
  changed.sqlite.close();
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  copyFileSync(backupPath, temporaryPath);
  writeRestoreJournal(dbPath, temporaryPath);
  writeFileSync(`${dbPath}-wal`, "old wal");
  writeFileSync(`${dbPath}-shm`, "old shm");

  await prepareDatabase(dbPath);

  const recovered = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(recovered.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("backup");
  } finally {
    recovered.sqlite.close();
  }
  expect(existsSync(temporaryPath)).toBe(false);
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  if (existsSync(`${dbPath}-wal`)) {
    expect(readFileSync(`${dbPath}-wal`, "utf8")).not.toBe("old wal");
  }
  if (existsSync(`${dbPath}-shm`)) {
    expect(readFileSync(`${dbPath}-shm`, "utf8")).not.toBe("old shm");
  }
});

it("abandons a corrupt journaled copy without changing the current database", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-corrupt-recovery-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const current = createClient(dbPath, { fileMustExist: true });
  current.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  current.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("current");
  current.sqlite.close();
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  writeFileSync(temporaryPath, "corrupt restore copy");
  writeRestoreJournal(dbPath, temporaryPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(temporaryPath)).toBe(false);
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  const unchanged = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(unchanged.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("current");
  } finally {
    unchanged.sqlite.close();
  }
});

it("abandons an unreadable journal once when the current database is safe", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-unreadable-journal-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const current = createClient(dbPath, { fileMustExist: true });
  current.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  current.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("current");
  current.sqlite.close();
  writeFileSync(`${dbPath}.restore-journal`, "invalid journal");

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
  const unchanged = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(unchanged.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("current");
  } finally {
    unchanged.sqlite.close();
  }
});

it("leaves an unreadable journal and current sidecars untouched when recovery is ambiguous", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-unreadable-sidecars-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  writeFileSync(`${dbPath}-wal`, "current wal");
  writeFileSync(`${dbPath}.restore-journal`, "invalid journal");

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(readFileSync(`${dbPath}-wal`, "utf8")).toBe("current wal");
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(true);
});

it("restores an explicit backup after preserving an ambiguous journal and sidecars", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-ambiguous-explicit-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const original = createClient(dbPath);
  original.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  original.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("backup");
  original.sqlite.close();
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));

  const changed = createClient(dbPath);
  changed.sqlite.prepare("UPDATE evidence SET value = ?").run("current");
  changed.sqlite.close();
  writeFileSync(`${dbPath}-wal`, "ambiguous wal");
  writeFileSync(`${dbPath}-shm`, "ambiguous shm");
  writeFileSync(`${dbPath}.restore-journal`, "unreadable journal");

  const restored = await restoreDatabaseBackup(dbPath, backupPath);

  if (restored.preservedPath === null) throw new Error("Current state was not preserved");
  expect(readFileSync(join(restored.preservedPath, "otomat.db-wal"), "utf8")).toBe("ambiguous wal");
  expect(readFileSync(join(restored.preservedPath, "otomat.db-shm"), "utf8")).toBe("ambiguous shm");
  expect(readFileSync(join(restored.preservedPath, "otomat.db.restore-journal"), "utf8")).toBe(
    "unreadable journal",
  );
  const reopened = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(reopened.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("backup");
  } finally {
    reopened.sqlite.close();
  }
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
});

it("preserves multiple ambiguous restore copies before an explicit restore", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-ambiguous-copies-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupPath = await createConsistentBackup(dbPath, join(scratch, "backups"));
  const firstCopy = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  const secondCopy = `${dbPath}.restore-${TEST_UUID_V4_ALTERNATE}.partial`;
  writeFileSync(firstCopy, "first interrupted copy");
  writeFileSync(secondCopy, "second interrupted copy");
  writeFileSync(`${dbPath}.restore-journal`, "unreadable journal");

  const restored = await restoreDatabaseBackup(dbPath, backupPath);

  if (restored.preservedPath === null) throw new Error("Ambiguous copies were not preserved");
  expect(readFileSync(join(restored.preservedPath, basename(firstCopy)), "utf8")).toBe(
    "first interrupted copy",
  );
  expect(readFileSync(join(restored.preservedPath, basename(secondCopy)), "utf8")).toBe(
    "second interrupted copy",
  );
});

it("does not delete ambiguous restore copies when the selected backup is invalid", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-ambiguous-invalid-backup-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const backupsDir = join(scratch, "backups");
  mkdirSync(backupsDir, { recursive: true });
  const invalidBackup = join(backupsDir, `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V4}.sqlite`);
  writeFileSync(invalidBackup, "not sqlite");
  const firstCopy = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  const secondCopy = `${dbPath}.restore-${TEST_UUID_V4_ALTERNATE}.partial`;
  writeFileSync(firstCopy, "first interrupted copy");
  writeFileSync(secondCopy, "second interrupted copy");
  writeFileSync(`${dbPath}.restore-journal`, "unreadable journal");

  await expect(restoreDatabaseBackup(dbPath, invalidBackup)).rejects.toMatchObject({
    code: "invalid_backup",
  });
  expect(readFileSync(firstCopy, "utf8")).toBe("first interrupted copy");
  expect(readFileSync(secondCopy, "utf8")).toBe("second interrupted copy");
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(true);
});

it("abandons an identified non-regular restore copy without following it", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-linked-copy-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const externalPath = join(scratch, "external.sqlite");
  writeFileSync(externalPath, "external data");
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  writeFileSync(temporaryPath, "journal identity");
  writeRestoreJournal(dbPath, temporaryPath);
  rmSync(temporaryPath);
  symlinkSync(externalPath, temporaryPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  expect(existsSync(temporaryPath)).toBe(false);
  expect(readFileSync(externalPath, "utf8")).toBe("external data");
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
});

it("abandons a journal whose database and restore copy are both missing", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-missing-artifacts-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  writeFileSync(temporaryPath, "journal identity");
  writeRestoreJournal(dbPath, temporaryPath);
  rmSync(temporaryPath);
  rmSync(dbPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
  expect(existsSync(dbPath)).toBe(false);
});

it("abandons an unreadable journal when the initialized database is missing", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-unreadable-missing-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  removeDatabaseArtifacts(dbPath);
  writeFileSync(`${dbPath}.restore-journal`, "invalid journal");

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "database_missing" });
  expect(existsSync(dbPath)).toBe(false);
});

it("does not delete the current WAL when a journaled copy disappears before installation", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-restore-missing-copy-wal-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.pragma("wal_autocheckpoint = 0");
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("wal-only");
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  copyFileSync(dbPath, temporaryPath);
  writeRestoreJournal(dbPath, temporaryPath);
  rmSync(temporaryPath);

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  expect(live.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("wal-only");
  live.sqlite.close();
  await expect(prepareDatabase(dbPath)).resolves.toBeUndefined();
});

it("reports low disk before copying the current database into preservation", async () => {
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
