import { statfsSync } from "node:fs";

import type Database from "better-sqlite3";

import { DataSafetyError } from "./errors.js";

const MIGRATION_HEADROOM_BYTES = 16 * 1024 * 1024;

export function availableDiskBytes(path: string): number {
  const stats = statfsSync(path);
  return stats.bavail * stats.bsize;
}

export function databaseBytes(sqlite: Database.Database): number {
  const pageCount = Number(sqlite.pragma("page_count", { simple: true }));
  const pageSize = Number(sqlite.pragma("page_size", { simple: true }));
  return pageCount * pageSize;
}

export function requiredPreMigrationBytes(sqlite: Database.Database): number {
  return 3 * databaseBytes(sqlite) + MIGRATION_HEADROOM_BYTES;
}

export function requiredRestoreBytes(
  backup: Database.Database,
  currentArtifactBytes: number,
  hasPendingMigrations: boolean,
): number {
  const backupBytes = databaseBytes(backup);
  const installationPeak = backupBytes + currentArtifactBytes;
  if (!hasPendingMigrations) return installationPeak;
  const restartMigrationPeak = backupBytes + requiredPreMigrationBytes(backup);
  return Math.max(installationPeak, restartMigrationPeak);
}

export function assertSufficientDiskSpace(availableBytes: number, requiredBytes: number): void {
  if (availableBytes >= requiredBytes) return;
  throw new DataSafetyError(
    "low_disk",
    `Not enough disk space for a safe database operation: ${requiredBytes} bytes required, ${availableBytes} available.`,
    { availableBytes, requiredBytes },
  );
}
