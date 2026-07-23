import { DataSafetyError } from "@otomat/db";
import {
  isPlainDataSafetyErrorCode,
  isRecoverableDataSafetyErrorCode,
  STARTUP_DIAGNOSTIC_PREFIX,
  type DataSafetyErrorCode,
  type DesktopStartupDiagnostic,
} from "@otomat/domain";

const SAFE_MESSAGES: Record<DataSafetyErrorCode, string> = {
  backup_failed: "Otomat could not create a safe database backup.",
  database_corrupt:
    "The SQLite database failed its integrity check. Otomat did not modify or recreate it.",
  database_missing: "The initialized SQLite database is missing. Otomat did not recreate it.",
  invalid_backup: "The selected backup is missing or failed its integrity check.",
  low_disk: "There is not enough free disk space to protect the database before continuing.",
  migration_failed:
    "Database migration failed. Recovery is available from the pre-migration backup.",
  restore_failed: "Database restoration failed. Otomat preserved the original database state.",
  schema_incompatible: "The SQLite schema is newer than or incompatible with this Otomat build.",
};

export function serializeStartupDiagnostic(error: unknown): DesktopStartupDiagnostic {
  if (error instanceof DataSafetyError) {
    const details = error.details;
    const message =
      error.code === "migration_failed" && error.backupPath === null
        ? "Database initialization failed. Otomat did not reset the database."
        : SAFE_MESSAGES[error.code];
    if (details.code === "low_disk") {
      return {
        code: details.code,
        message,
        backup_path: null,
        available_bytes: details.availableBytes,
        required_bytes: details.requiredBytes,
      };
    }
    if (isRecoverableDataSafetyErrorCode(details.code)) {
      return {
        code: details.code,
        message,
        backup_path: details.backupPath,
        available_bytes: null,
        required_bytes: null,
      };
    }
    if (isPlainDataSafetyErrorCode(details.code)) {
      return {
        code: details.code,
        message,
        backup_path: null,
        available_bytes: null,
        required_bytes: null,
      };
    }
  }
  return {
    code: "startup_failed",
    message: "The local daemon could not be started.",
    backup_path: null,
    available_bytes: null,
    required_bytes: null,
  };
}

export function formatStartupDiagnostic(error: unknown): string {
  return `${STARTUP_DIAGNOSTIC_PREFIX}${JSON.stringify(serializeStartupDiagnostic(error))}`;
}
