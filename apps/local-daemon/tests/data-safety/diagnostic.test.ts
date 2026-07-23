import { DataSafetyError } from "@otomat/db";
import { expect, it } from "vitest";

import { serializeStartupDiagnostic } from "#data-safety/diagnostic";

it("serializes only safe recovery fields from a database failure", () => {
  const diagnostic = serializeStartupDiagnostic(
    new DataSafetyError(
      "migration_failed",
      'Database migration failed. lin_api_do_not_leak prompt="private"',
      {
        backupPath: "/data/backups/otomat.sqlite",
      },
    ),
  );

  expect(diagnostic).toEqual({
    code: "migration_failed",
    message: "Database migration failed. Recovery is available from the pre-migration backup.",
    backup_path: "/data/backups/otomat.sqlite",
    available_bytes: null,
    required_bytes: null,
  });
  expect(JSON.stringify(diagnostic)).not.toContain("lin_api");
  expect(JSON.stringify(diagnostic)).not.toContain("private");
});

it("does not expose unknown startup error messages", () => {
  expect(serializeStartupDiagnostic(new Error("secret prompt contents"))).toMatchObject({
    code: "startup_failed",
    message: "The local daemon could not be started.",
  });
});

it("serializes a missing database as recoverable when a managed backup is known", () => {
  expect(
    serializeStartupDiagnostic(
      new DataSafetyError("database_missing", "missing", {
        backupPath: "/data/backups/otomat-backup.sqlite",
      }),
    ),
  ).toMatchObject({
    code: "database_missing",
    backup_path: "/data/backups/otomat-backup.sqlite",
  });
});
