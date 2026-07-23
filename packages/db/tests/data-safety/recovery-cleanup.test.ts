import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({ removalPath: "" }));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    rmSync: (...args: Parameters<typeof original.rmSync>): void => {
      if (args[0] === injectedFailure.removalPath) {
        throw new Error("injected orphan cleanup failure");
      }
      original.rmSync(...args);
    },
  };
});

import { createClient } from "#db/client";
import { prepareDatabase } from "#db/data-safety/prepare";
import { writeRestoreJournal } from "#db/data-safety/restore-journal";
import { TEST_TIMESTAMP, TEST_UUID_V4 } from "#test-support/generated-artifact-names";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.removalPath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("completes a journaled restore even when unrelated orphan cleanup fails", async () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-recovery-cleanup-"));
  const dbPath = join(scratch, "otomat.db");
  await prepareDatabase(dbPath);
  const live = createClient(dbPath, { fileMustExist: true });
  live.sqlite.exec("CREATE TABLE evidence (value TEXT NOT NULL)");
  live.sqlite.prepare("INSERT INTO evidence (value) VALUES (?)").run("restored");
  live.sqlite.close();
  const temporaryPath = `${dbPath}.restore-${TEST_UUID_V4}.partial`;
  copyFileSync(dbPath, temporaryPath);
  writeRestoreJournal(dbPath, temporaryPath);
  const orphanDirectory = join(
    scratch,
    "backups",
    `pre-restore-${TEST_TIMESTAMP}-${TEST_UUID_V4}.partial`,
  );
  mkdirSync(orphanDirectory, { recursive: true });
  injectedFailure.removalPath = orphanDirectory;

  await expect(prepareDatabase(dbPath)).rejects.toMatchObject({ code: "restore_failed" });
  expect(existsSync(temporaryPath)).toBe(false);
  expect(existsSync(`${dbPath}.restore-journal`)).toBe(false);
  const restored = createClient(dbPath, { readonly: true, fileMustExist: true });
  try {
    expect(restored.sqlite.prepare("SELECT value FROM evidence").pluck().get()).toBe("restored");
  } finally {
    restored.sqlite.close();
  }
});
