import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { createClient } from "#db/client";
import { runMigrations } from "#db/migrate";

let scratch: string | null = null;

afterEach(() => {
  delete process.env.OTOMAT_DB_PATH;
  vi.resetModules();
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("routes the migration command through safe preparation before applying pending work", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-migration-command-"));
  const dbPath = join(scratch, "otomat.db");
  runMigrations(dbPath);
  const client = createClient(dbPath, { fileMustExist: true });
  client.sqlite.exec(`
    DELETE FROM __drizzle_migrations
    WHERE created_at = (SELECT MAX(created_at) FROM __drizzle_migrations)
  `);
  client.sqlite.close();
  process.env.OTOMAT_DB_PATH = dbPath;

  await expect(import("#db/bin/migrate")).rejects.toMatchObject({
    code: "migration_failed",
  });

  const backupsDir = join(scratch, "backups");
  expect(existsSync(dbPath)).toBe(true);
  expect(readdirSync(backupsDir)).toHaveLength(1);
});
