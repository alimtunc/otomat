import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient, prepareDatabase } from "@otomat/db";
import { afterEach, expect, it } from "vitest";

import { runRestoreMaintenance } from "#data-safety/maintenance";

let scratch: string | null = null;

afterEach(() => {
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("restores a managed backup without starting the HTTP daemon", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-maintenance-restore-"));
  const dbPath = join(scratch, "otomat.db");
  const backupsDir = join(scratch, "backups");
  const backupPath = join(
    backupsDir,
    "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  );
  mkdirSync(backupsDir);
  await prepareDatabase(dbPath);
  const original = createClient(dbPath, { fileMustExist: true });
  original.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  original.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("before");
  original.sqlite.close();
  copyFileSync(dbPath, backupPath);
  const changed = createClient(dbPath, { fileMustExist: true });
  changed.sqlite.prepare("UPDATE evidence SET value = ?").run("after");
  changed.sqlite.close();

  await expect(runRestoreMaintenance(dbPath, backupPath)).resolves.toContain('"action":"restore"');
  const restored = createClient(dbPath);
  try {
    expect(restored.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("before");
  } finally {
    restored.sqlite.close();
  }
});
