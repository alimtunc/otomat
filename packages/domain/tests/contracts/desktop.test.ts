import { expect, it } from "vitest";

import {
  DATABASE_INITIALIZED_MARKER_SUFFIX,
  isManagedBackupFilename,
  MANAGED_BACKUPS_DIRECTORY_NAME,
  managedBackupFilenamePrefix,
} from "#domain/contracts/data-safety";
import { desktopStartupDiagnosticSchema } from "#domain/contracts/desktop";

it("uses one filename contract for managed backup creation and discovery", () => {
  expect(managedBackupFilenamePrefix("otomat.db")).toBe("otomat-backup-");
  expect(MANAGED_BACKUPS_DIRECTORY_NAME).toBe("backups");
  expect(DATABASE_INITIALIZED_MARKER_SUFFIX).toBe(".initialized");
  expect(
    isManagedBackupFilename(
      "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
      "otomat.db",
    ),
  ).toBe(true);
  expect(isManagedBackupFilename("otomat-backup-2026.sqlite", "otomat.db")).toBe(false);
  expect(
    isManagedBackupFilename(
      "otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-52d3-a456-426614174002.sqlite",
      "otomat.db",
    ),
  ).toBe(false);
  expect(
    isManagedBackupFilename(
      "otomat-backup-2026-99-99T99-99-99.999Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
      "otomat.db",
    ),
  ).toBe(false);
  expect(isManagedBackupFilename("other-backup-2026.sqlite", "otomat.db")).toBe(false);
});

it("parses a recoverable migration diagnostic with a managed backup", () => {
  const diagnostic = desktopStartupDiagnosticSchema.parse({
    code: "migration_failed",
    message: "Database migration failed.",
    backup_path:
      "/data/backups/otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
    available_bytes: null,
    required_bytes: null,
  });

  expect(diagnostic.backup_path).toContain("/backups/");
});

it("allows a missing database diagnostic to carry its managed recovery backup", () => {
  expect(
    desktopStartupDiagnosticSchema.parse({
      code: "database_missing",
      message: "The initialized database is missing.",
      backup_path:
        "/data/backups/otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
      available_bytes: null,
      required_bytes: null,
    }),
  ).toMatchObject({
    code: "database_missing",
    backup_path:
      "/data/backups/otomat-backup-2026-07-23T10-00-00.000Z-123e4567-e89b-42d3-a456-426614174000.sqlite",
  });
});

it("rejects an unknown startup error code", () => {
  expect(
    desktopStartupDiagnosticSchema.safeParse({
      code: "reset_database",
      message: "Resetting",
      backup_path: null,
      available_bytes: null,
      required_bytes: null,
    }).success,
  ).toBe(false);
});

it("rejects a low-disk diagnostic without capacity evidence", () => {
  expect(
    desktopStartupDiagnosticSchema.safeParse({
      code: "low_disk",
      message: "Not enough disk space.",
      backup_path: null,
      available_bytes: null,
      required_bytes: null,
    }).success,
  ).toBe(false);
});
