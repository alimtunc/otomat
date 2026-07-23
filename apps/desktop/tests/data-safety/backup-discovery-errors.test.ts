import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

const injectedFailure = vi.hoisted(() => ({ directoryPath: "", filePath: "" }));

vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    lstatSync: (path: string, options?: { throwIfNoEntry?: boolean }) => {
      if (path === injectedFailure.directoryPath) {
        throw Object.assign(new Error("injected backup directory failure"), { code: "EIO" });
      }
      return original.lstatSync(path, options);
    },
    openSync: (path: string, flags: string | number, mode?: number): number => {
      if (path === injectedFailure.filePath) {
        throw Object.assign(new Error("injected backup read failure"), { code: "EIO" });
      }
      return original.openSync(path, flags, mode);
    },
  };
});

import { findLatestManagedBackup } from "#main/data-safety/backup-discovery";

let scratch: string | null = null;

afterEach(() => {
  injectedFailure.directoryPath = "";
  injectedFailure.filePath = "";
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

it("propagates operational failures while inspecting a managed backup", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-discovery-"));
  const backupsDirectory = join(scratch, "backups");
  mkdirSync(backupsDirectory);
  const backupPath = join(
    backupsDirectory,
    "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  );
  writeFileSync(backupPath, "backup");
  injectedFailure.filePath = backupPath;

  expect(() => findLatestManagedBackup(backupsDirectory, "otomat.db")).toThrow(
    /injected backup read failure/,
  );
});

it("propagates operational failures while inspecting the backups directory", () => {
  scratch = mkdtempSync(join(tmpdir(), "otomat-backup-directory-"));
  const backupsDirectory = join(scratch, "backups");
  mkdirSync(backupsDirectory);
  injectedFailure.directoryPath = backupsDirectory;

  expect(() => findLatestManagedBackup(backupsDirectory, "otomat.db")).toThrow(
    /injected backup directory failure/,
  );
});
