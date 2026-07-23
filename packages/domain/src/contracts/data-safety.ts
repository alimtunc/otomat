export const PLAIN_DATA_SAFETY_ERROR_CODES = [
  "backup_failed",
  "invalid_backup",
  "schema_incompatible",
] as const;

export const RECOVERABLE_DATA_SAFETY_ERROR_CODES = [
  "database_corrupt",
  "database_missing",
  "migration_failed",
  "restore_failed",
] as const;

export const DATA_SAFETY_ERROR_CODES = [
  ...PLAIN_DATA_SAFETY_ERROR_CODES,
  ...RECOVERABLE_DATA_SAFETY_ERROR_CODES,
  "low_disk",
] as const;

export type DataSafetyErrorCode = (typeof DATA_SAFETY_ERROR_CODES)[number];
export type PlainDataSafetyErrorCode = (typeof PLAIN_DATA_SAFETY_ERROR_CODES)[number];
export type RecoverableDataSafetyErrorCode = (typeof RECOVERABLE_DATA_SAFETY_ERROR_CODES)[number];

export function isRecoverableDataSafetyErrorCode(
  code: DataSafetyErrorCode,
): code is RecoverableDataSafetyErrorCode {
  return RECOVERABLE_DATA_SAFETY_ERROR_CODES.some((candidate) => candidate === code);
}

export function isPlainDataSafetyErrorCode(
  code: DataSafetyErrorCode,
): code is PlainDataSafetyErrorCode {
  return PLAIN_DATA_SAFETY_ERROR_CODES.some((candidate) => candidate === code);
}

export const MAINTENANCE_ACTION_ENV = "OTOMAT_MAINTENANCE_ACTION";
export const MAINTENANCE_RESTORE_ACTION = "restore";
export const RESTORE_BACKUP_ENV = "OTOMAT_RESTORE_BACKUP";
export const STARTUP_DIAGNOSTIC_PREFIX = "[otomat-startup-diagnostic] ";

export const MANAGED_BACKUPS_DIRECTORY_NAME = "backups";
export const MANAGED_BACKUP_FILENAME_SUFFIX = ".sqlite";
export const DATABASE_INITIALIZED_MARKER_SUFFIX = ".initialized";

const SANITIZED_ISO_TIMESTAMP_PATTERN =
  /^((?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2}\.\d{3}Z)$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV4(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export function isSanitizedIsoTimestamp(value: string): boolean {
  const match = SANITIZED_ISO_TIMESTAMP_PATTERN.exec(value);
  if (match === null) return false;
  const isoTimestamp = `${match[1]}:${match[2]}:${match[3]}`;
  const parsedTimestamp = new Date(isoTimestamp);
  return !Number.isNaN(parsedTimestamp.getTime()) && parsedTimestamp.toISOString() === isoTimestamp;
}

export function managedBackupFilenamePrefix(databaseFilename: string): string {
  const databaseStem = databaseFilename.endsWith(".db")
    ? databaseFilename.slice(0, -3)
    : databaseFilename;
  return `${databaseStem}-backup-`;
}

export function isManagedBackupFilename(filename: string, databaseFilename: string): boolean {
  const prefix = managedBackupFilenamePrefix(databaseFilename);
  if (!filename.startsWith(prefix) || !filename.endsWith(MANAGED_BACKUP_FILENAME_SUFFIX)) {
    return false;
  }
  const body = filename.slice(prefix.length, -MANAGED_BACKUP_FILENAME_SUFFIX.length);
  const uuid = body.slice(-36);
  const timestamp = body.slice(0, -37);
  return body.at(-37) === "-" && isSanitizedIsoTimestamp(timestamp) && isUuidV4(uuid);
}
