import {
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

import { afterEach, expect, it } from "vitest";

import { createClient } from "#db/client";
import { createConsistentBackup } from "#db/data-safety/backup";
import { DataSafetyError } from "#db/data-safety/errors";
import { prepareDatabase } from "#db/data-safety/prepare";
import { runMigrations } from "#db/migrate";
import {
  TEST_INVALID_TIMESTAMP,
  TEST_TIMESTAMP,
  TEST_UUID_V4,
  TEST_UUID_V5,
} from "#test-support/generated-artifact-names";

let scratch: string | null = null;

afterEach(() => {
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("captures committed rows that still live in the WAL", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-wal-backup-"));
  const dbPath = join(scratch, "otomat.db");
  runMigrations(dbPath);
  const live = createClient(dbPath);
  live.sqlite.pragma("wal_autocheckpoint = 0");
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("survives");
  expect(existsSync(`${dbPath}-wal`)).toBe(true);
  const backupsDir = join(scratch, "backups");
  mkdirSync(backupsDir);
  const orphan = join(backupsDir, `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V4}.sqlite.partial`);
  const nearMatch = join(
    backupsDir,
    `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V5}.sqlite.partial`,
  );
  const impossibleTimestamp = join(
    backupsDir,
    `otomat-backup-${TEST_INVALID_TIMESTAMP}-${TEST_UUID_V4}.sqlite.partial`,
  );
  writeFileSync(orphan, "incomplete");
  writeFileSync(nearMatch, "preserve");
  writeFileSync(impossibleTimestamp, "preserve");

  const backupPath = await createConsistentBackup(
    dbPath,
    backupsDir,
    new Date("2026-07-23T10:00:00.000Z"),
  );
  expect(readdirSync(backupsDir).toSorted()).toEqual(
    [basename(backupPath), basename(impossibleTimestamp), basename(nearMatch)].toSorted(),
  );
  const backup = createClient(backupPath, { readonly: true, fileMustExist: true });
  try {
    expect(backup.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("survives");
    expect(backup.sqlite.pragma("quick_check", { simple: true })).toBe("ok");
  } finally {
    backup.sqlite.close();
    live.sqlite.close();
  }
});

it("retains a usable backup when a pending migration fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-failed-migration-"));
  const dbPath = join(scratch, "otomat.db");
  runMigrations(dbPath);
  const current = createClient(dbPath);
  current.sqlite.exec(`
    INSERT INTO projects (id, name, root_path)
    VALUES ('proof-project', 'Proof', '/tmp/proof');
    DELETE FROM __drizzle_migrations
    WHERE created_at = (SELECT MAX(created_at) FROM __drizzle_migrations);
  `);
  current.sqlite.close();

  let failure: DataSafetyError | null = null;
  try {
    await prepareDatabase(dbPath);
  } catch (error) {
    if (error instanceof DataSafetyError) failure = error;
    else throw error;
  }

  expect(failure?.code).toBe("migration_failed");
  expect(failure?.backupPath).toBeTruthy();
  const backup = createClient(failure!.backupPath!, { readonly: true, fileMustExist: true });
  try {
    expect(
      backup.sqlite.prepare("SELECT name FROM projects WHERE id = 'proof-project'").pluck().get(),
    ).toBe("Proof");
  } finally {
    backup.sqlite.close();
  }
});

it("refuses a symlinked managed backups directory without touching its target", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-directory-link-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const outside = join(scratch, "outside");
  mkdirSync(outside);
  const sentinel = join(outside, `otomat-backup-${TEST_TIMESTAMP}-${TEST_UUID_V4}.sqlite.partial`);
  writeFileSync(sentinel, "keep");
  const backupsDir = join(scratch, "backups");
  symlinkSync(outside, backupsDir);

  await expect(createConsistentBackup(dbPath, backupsDir)).rejects.toMatchObject({
    code: "backup_failed",
  });
  expect(readFileSync(sentinel, "utf8")).toBe("keep");
  expect(readdirSync(outside)).toEqual([basename(sentinel)]);
});
